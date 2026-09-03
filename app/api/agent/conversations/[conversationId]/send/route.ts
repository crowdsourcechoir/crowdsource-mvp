import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import OpenAI from "openai";
import { getNextAgentMessage } from "@/lib/agent-llm";
import { localEventsGetById } from "@/lib/local-events-store";
import {
  localGetConversation,
  localInsertTurn,
  localGetParticipant,
  localUpdateParticipantEmail,
  localUpdateParticipantName,
} from "@/lib/local-agent-interview-store";
import { scheduleTranscriptionIfMediaPresent } from "@/lib/agent-post-submit-transcribe";
import { isEmailCaptchaPrompt, type AskAboutItemLike } from "@/lib/agent-brief-email-captcha";
import { isNameQuestionPrompt } from "@/lib/agent-name-question";
import { isTurnstileServerConfigured, verifyTurnstileToken } from "@/lib/turnstile";
import {
  participantDisplayName,
  participantNameUpdatePayload,
} from "@/lib/agent-participant-db";
import {
  kindFromInterviewMedia,
  recordGardenContribution,
} from "@/lib/song-garden-v2/garden/store";
import { effectCelebrationLine, type WorldEffect } from "@/lib/song-garden-v2/garden/types";
import type { SongGardenConfig } from "@/lib/songgarden/config";
import {
  eventHasManagedJourney,
  JOURNEY_MANAGED_STUB,
} from "@/lib/agent-journey-managed";
import {
  agentMediaPublicUrl,
  isPathForConversation,
  verifyAgentMediaObject,
} from "@/lib/agent-media/storage-upload";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

async function gardenPayloadForTurn(args: {
  eventId: string;
  turnId: string;
  content: string;
  hasAudio: boolean;
  hasVideo: boolean;
  deviceId: string | null;
}): Promise<{
  gardenEffects: WorldEffect[] | null;
  gardenCelebrationLine: string | null;
  gardenWorldVersion: number | null;
}> {
  const kind = kindFromInterviewMedia({
    content: args.content,
    hasAudio: args.hasAudio,
    hasVideo: args.hasVideo,
  });
  if (!kind) {
    return { gardenEffects: null, gardenCelebrationLine: null, gardenWorldVersion: null };
  }
  const garden = await recordGardenContribution({
    eventId: args.eventId,
    kind,
    sourceType: "turn",
    sourceId: args.turnId,
    deviceId: args.deviceId,
  });
  return {
    gardenEffects: garden?.effects ?? null,
    gardenCelebrationLine: garden ? effectCelebrationLine(garden.effects) : null,
    gardenWorldVersion: garden?.worldVersion ?? null,
  };
}

function rowToTurn(row: Record<string, unknown>) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    turnIndex: row.turn_index,
    role: row.role,
    content: row.content,
    audioUrl: row.audio_url ?? null,
    videoUrl: row.video_url ?? null,
    audioTranscript: row.audio_transcript ?? null,
    videoTranscript: row.video_transcript ?? null,
    createdAt: row.created_at,
  };
}

const DEFAULT_THEME = {
  system_prompt_template:
    "You are a warm, friendly host at an event. Ask one short, casual question at a time. Draw out memories, shoutouts, and wishes. Use the event context and brief to personalize. Keep it conversational and do not collect sensitive personal info.",
  max_questions: 8,
  do_dont_rules: [] as string[],
};
const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "agent-media";
let mediaBucketChecked = false;

function validEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

async function verifyEmailStepCaptcha(
  request: Request,
  captchaToken: string | null | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isTurnstileServerConfigured()) {
    return {
      ok: false,
      error: "Turnstile is not configured on the server. Add TURNSTILE_SECRET_KEY to .env.local.",
    };
  }
  if (!captchaToken) {
    return { ok: false, error: "Complete verification before submitting your email." };
  }
  const forwardedFor = request.headers.get("x-forwarded-for");
  const remoteIp = forwardedFor?.split(",")[0]?.trim() || request.headers.get("cf-connecting-ip");
  const captcha = await verifyTurnstileToken({ token: captchaToken, remoteIp });
  if (!captcha.ok) {
    return { ok: false, error: captcha.error ?? "Captcha verification failed." };
  }
  return { ok: true };
}

function requiresEmailCaptcha(
  brief: Record<string, unknown> | null,
  lastAgentContent: string
): boolean {
  const raw = Array.isArray(brief?.askAboutItems)
    ? (brief.askAboutItems as Array<{ prompt?: string; requireEmailCaptcha?: boolean }>)
    : [];
  const items: AskAboutItemLike[] = raw
    .filter((item): item is { prompt: string; requireEmailCaptcha?: boolean } =>
      typeof item?.prompt === "string" && item.prompt.trim().length > 0
    )
    .map((item) => ({
      prompt: item.prompt.trim(),
      requireEmailCaptcha: item.requireEmailCaptcha,
    }));
  return isEmailCaptchaPrompt(items, lastAgentContent);
}

function extFromMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  return "bin";
}

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string; extension: string } {
  // MediaRecorder often emits types like "video/webm;codecs=vp9,opus" — allow MIME params
  // between the type and ";base64," instead of requiring a bare type.
  const match = dataUrl.match(/^data:([^,]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid media format.");
  const contentType = match[1].split(";")[0].trim() || "application/octet-stream";
  const bytes = Buffer.from(match[2], "base64");
  return { bytes, contentType, extension: extFromMime(contentType) };
}

async function ensureMediaBucket() {
  if (!supabaseAdmin || mediaBucketChecked) return;
  mediaBucketChecked = true;
  const { data: existing, error: listErr } = await supabaseAdmin.storage.listBuckets();
  if (listErr) return;
  if (!existing?.some((b) => b.name === MEDIA_BUCKET)) {
    await supabaseAdmin.storage.createBucket(MEDIA_BUCKET, { public: true });
  }
}

async function persistMedia(conversationId: string, kind: "audio" | "video", dataUrl: string | null): Promise<string | null> {
  if (!dataUrl) return null;
  if (!supabaseAdmin) return dataUrl;

  await ensureMediaBucket();
  const parsed = decodeDataUrl(dataUrl);
  const filePath = `conversations/${conversationId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${parsed.extension}`;
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(filePath, parsed.bytes, {
      contentType: parsed.contentType,
      upsert: false,
    });

  if (uploadErr) throw new Error(`Failed to upload ${kind}.`);
  const { data } = supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

async function resolveTurnMediaUrl(
  conversationId: string,
  kind: "audio" | "video",
  direct: { storagePath?: string | null; publicUrl?: string | null },
  dataUrl: string | null
): Promise<string | null> {
  const path = direct.storagePath?.trim();
  if (path) {
    if (!isPathForConversation(conversationId, path)) {
      throw new Error(`Invalid ${kind} storage path.`);
    }
    const ok = await verifyAgentMediaObject(path);
    if (!ok) {
      throw new Error(`${kind} upload not found. Complete the Storage PUT before send.`);
    }
    return direct.publicUrl?.trim() || agentMediaPublicUrl(path);
  }
  return persistMedia(conversationId, kind, dataUrl);
}

function hasTurnMedia(body: {
  audioDataUrl?: string | null;
  videoDataUrl?: string | null;
  audioStoragePath?: string | null;
  videoStoragePath?: string | null;
}): boolean {
  return Boolean(
    body.audioDataUrl ||
      body.videoDataUrl ||
      body.audioStoragePath?.trim() ||
      body.videoStoragePath?.trim()
  );
}

export const maxDuration = 30;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;

  // Local fallback: when using local events, avoid Supabase entirely for the interview flow.
  if (USE_LOCAL_EVENTS) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not set." }, { status: 503 });

    try {
      const body = await request.json();
      const rawContent = typeof body.content === "string" ? body.content : "";
      const content = rawContent === "__skip_name__" ? "" : rawContent.trim();
      const audioDataUrl = typeof body.audioDataUrl === "string" ? body.audioDataUrl : null;
      const videoDataUrl = typeof body.videoDataUrl === "string" ? body.videoDataUrl : null;
      const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : null;
      const journeyManagedRequested = body.journeyManaged === true;
      const deviceId =
        typeof body.deviceId === "string" && /^dev_[a-zA-Z0-9_-]{8,64}$/.test(body.deviceId.trim())
          ? body.deviceId.trim()
          : null;

      const local = await localGetConversation(conversationId);
      if (!local) return NextResponse.json(null, { status: 404 });

      const eventData = localEventsGetById(local.conversation.eventId);
      if (!eventData) return NextResponse.json({ error: "Event not found." }, { status: 404 });

      const existingTurns = local.turns.map((t) => ({
        turn_index: t.turnIndex,
        role: t.role,
        content: t.content,
      }));

      const isFirstMessage = existingTurns.length === 0;
      const lastAgentContent =
        existingTurns.length > 0
          ? [...existingTurns].reverse().find((t) => t.role === "agent")?.content ?? ""
          : "";

      const isVoiceVideoQuestion = /record/.test(lastAgentContent) && /voice|video/.test(lastAgentContent);

      const brief = eventData.agent_brief as Record<string, unknown> | null;
      const needsEmailCaptcha = requiresEmailCaptcha(brief, lastAgentContent);

      const DEFAULT_THEME = {
        system_prompt_template:
          "You are a warm, friendly host at an event. Ask one short, casual question at a time. Draw out memories and wishes from the participant. Use the event context and any provided brief to personalize. Do not collect sensitive personal info. Keep questions conversational and high-signal.",
        max_questions: 8,
        do_dont_rules: [] as string[],
      };

      let userTurn: {
        id: string;
        conversationId: string;
        turnIndex: number;
        role: "agent" | "user";
        content: string;
        audioUrl: string | null;
        videoUrl: string | null;
        audioTranscript: string | null;
        videoTranscript: string | null;
        createdAt: string;
      } | null = null;

      let managedFirstUserTurn = false;
      if (isFirstMessage && content !== "") {
        const managedOk =
          journeyManagedRequested &&
          eventHasManagedJourney(
            (eventData.song_garden_config as SongGardenConfig | null) ?? null,
            null
          );
        if (!managedOk) {
          return NextResponse.json(
            { error: "Unexpected message before interview started." },
            { status: 400 }
          );
        }
        managedFirstUserTurn = true;
      }

      if (isFirstMessage && content === "") {
        const managedJourney =
          journeyManagedRequested &&
          eventHasManagedJourney(
            (eventData.song_garden_config as SongGardenConfig | null) ?? null,
            null
          );
        if (managedJourney) {
          return NextResponse.json({
            turn: null,
            nextMessage: {
              ...JOURNEY_MANAGED_STUB,
              suggestedAnswerTypes: ["text"],
            },
          });
        }

        const nextResult = await getNextAgentMessage(new OpenAI({ apiKey }), {
          theme: DEFAULT_THEME,
          brief: eventData.agent_brief ? (eventData.agent_brief as any) : null,
          eventTitle: eventData.title,
          conversationHistory: [],
          participantName: null,
          currentStep: 1,
        });

        const firstAgentTurn = await localInsertTurn({
          conversationId,
          turnIndex: 0,
          role: "agent",
          content: nextResult.agentMessage,
        });

        return NextResponse.json({
          turn: null,
          nextMessage: {
            agentMessage: nextResult.agentMessage,
            suggestedAnswerTypes: nextResult.suggestedAnswerTypes,
            extractedTags: nextResult.extractedTags,
            stopReason: nextResult.stopReason,
          },
          agentTurn: {
            id: firstAgentTurn.id,
            conversationId: firstAgentTurn.conversationId,
            turnIndex: firstAgentTurn.turnIndex,
            role: "agent",
            content: firstAgentTurn.content,
            audioUrl: firstAgentTurn.audioUrl,
            videoUrl: firstAgentTurn.videoUrl,
            audioTranscript: firstAgentTurn.audioTranscript,
            videoTranscript: firstAgentTurn.videoTranscript,
            createdAt: firstAgentTurn.createdAt,
          },
        });
      }

      if (!isFirstMessage || managedFirstUserTurn) {
      const journeyNameStep = body.journeyNameStep === true;
      const isNameQuestion =
        isNameQuestionPrompt(brief as Record<string, unknown>, lastAgentContent) ||
        (managedFirstUserTurn && journeyNameStep);
      if (isNameQuestion && !content) {
        return NextResponse.json({ error: "Please enter a name." }, { status: 400 });
      }
      if (!content && !hasTurnMedia(body) && !isVoiceVideoQuestion) {
        return NextResponse.json({
          turn: null,
          nextMessage: {
            agentMessage: lastAgentContent,
            suggestedAnswerTypes: ["text"],
            extractedTags: undefined,
            stopReason: "continue",
          },
          agentTurn: null,
        });
      }
      if (needsEmailCaptcha) {
        if (!validEmail(content)) {
          return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
        }
        const captcha = await verifyEmailStepCaptcha(request, captchaToken);
        if (!captcha.ok) {
          return NextResponse.json({ error: captcha.error }, { status: 400 });
        }
        await localUpdateParticipantEmail({
          participantId: local.conversation.participantId,
          email: content.toLowerCase(),
        });
      }
      if (isNameQuestion && content) {
        await localUpdateParticipantName({
          participantId: local.conversation.participantId,
          name: content.trim(),
        });
      }

      const userTurnInserted = await localInsertTurn({
        conversationId,
        turnIndex: existingTurns.length,
        role: "user",
        content,
        audioUrl: audioDataUrl,
        videoUrl: videoDataUrl,
      });
      scheduleTranscriptionIfMediaPresent({
        turnId: userTurnInserted.id,
        audioUrl: audioDataUrl,
        videoUrl: videoDataUrl,
        mode: "local",
      });

      const managedJourney =
        journeyManagedRequested &&
        eventHasManagedJourney(
          (eventData.song_garden_config as SongGardenConfig | null) ?? null,
          null
        );

      const gardenFields = await gardenPayloadForTurn({
        eventId: eventData.id,
        turnId: userTurnInserted.id,
        content,
        hasAudio: Boolean(audioDataUrl),
        hasVideo: Boolean(videoDataUrl),
        deviceId,
      });

      if (managedJourney) {
        return NextResponse.json({
          turn: {
            id: userTurnInserted.id,
            conversationId,
            turnIndex: userTurnInserted.turnIndex,
            role: "user",
            content: userTurnInserted.content,
            audioUrl: userTurnInserted.audioUrl,
            videoUrl: userTurnInserted.videoUrl,
            audioTranscript: userTurnInserted.audioTranscript,
            videoTranscript: userTurnInserted.videoTranscript,
            createdAt: userTurnInserted.createdAt,
          },
          nextMessage: {
            ...JOURNEY_MANAGED_STUB,
            suggestedAnswerTypes: ["text"],
          },
          ...gardenFields,
        });
      }

      const agentCount = existingTurns.filter((t) => t.role === "agent").length;
      const currentStep = agentCount + 1;

      const participant = await localGetParticipant(local.conversation.participantId);
      const participantName = participant?.displayName ?? null;

      const history = existingTurns.map((t) => ({ role: t.role as "agent" | "user", content: t.content }));
      history.push({ role: "user", content });

      const nextResult = await getNextAgentMessage(new OpenAI({ apiKey }), {
        theme: DEFAULT_THEME,
        brief: eventData.agent_brief ? (eventData.agent_brief as any) : null,
        eventTitle: eventData.title,
        conversationHistory: history.map((h) => ({ role: h.role, content: h.content })),
        participantName,
        currentStep,
      });

      const agentTurnIndex = existingTurns.length + 1;
      const agentTurnInserted = await localInsertTurn({
        conversationId,
        turnIndex: agentTurnIndex,
        role: "agent",
        content: nextResult.agentMessage,
      });

      return NextResponse.json({
        turn: {
          id: userTurnInserted.id,
          conversationId,
          turnIndex: userTurnInserted.turnIndex,
          role: "user",
          content: userTurnInserted.content,
          audioUrl: userTurnInserted.audioUrl,
          videoUrl: userTurnInserted.videoUrl,
          audioTranscript: userTurnInserted.audioTranscript,
          videoTranscript: userTurnInserted.videoTranscript,
          createdAt: userTurnInserted.createdAt,
        },
        nextMessage: {
          agentMessage: nextResult.agentMessage,
          suggestedAnswerTypes: nextResult.suggestedAnswerTypes,
          extractedTags: nextResult.extractedTags,
          stopReason: nextResult.stopReason,
        },
        agentTurn: {
          id: agentTurnInserted.id,
          conversationId,
          turnIndex: agentTurnInserted.turnIndex,
          role: "agent",
          content: agentTurnInserted.content,
          audioUrl: agentTurnInserted.audioUrl,
          videoUrl: agentTurnInserted.videoUrl,
          audioTranscript: agentTurnInserted.audioTranscript,
          videoTranscript: agentTurnInserted.videoTranscript,
          createdAt: agentTurnInserted.createdAt,
        },
        ...gardenFields,
      });
      }
    } catch (err) {
      console.error("Local agent send error:", err);
      return NextResponse.json({ error: "Local agent interview server error" }, { status: 500 });
    }
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set." },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const rawContent = typeof body.content === "string" ? body.content : "";
    const content = rawContent === "__skip_name__" ? "" : rawContent.trim();
    const audioDataUrl = typeof body.audioDataUrl === "string" ? body.audioDataUrl : null;
    const videoDataUrl = typeof body.videoDataUrl === "string" ? body.videoDataUrl : null;
    const audioStoragePath =
      typeof body.audioStoragePath === "string" ? body.audioStoragePath : null;
    const videoStoragePath =
      typeof body.videoStoragePath === "string" ? body.videoStoragePath : null;
    const audioPublicUrl = typeof body.audioPublicUrl === "string" ? body.audioPublicUrl : null;
    const videoPublicUrl = typeof body.videoPublicUrl === "string" ? body.videoPublicUrl : null;
    const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : null;
    const journeyManagedRequested = body.journeyManaged === true;
    const deviceId =
      typeof body.deviceId === "string" && /^dev_[a-zA-Z0-9_-]{8,64}$/.test(body.deviceId.trim())
        ? body.deviceId.trim()
        : null;

    const { data: conv, error: eConv } = await supabaseAdmin
      .from("agent_conversations")
      .select("id, event_id, local_event_id, participant_id")
      .eq("id", conversationId)
      .single();
    if (eConv || !conv) {
      if (eConv?.code === "PGRST116") return NextResponse.json(null, { status: 404 });
      return NextResponse.json({ error: eConv?.message ?? "Not found" }, { status: 500 });
    }

    const storedAudioUrl = await resolveTurnMediaUrl(
      conversationId,
      "audio",
      { storagePath: audioStoragePath, publicUrl: audioPublicUrl },
      audioDataUrl
    );
    const storedVideoUrl = await resolveTurnMediaUrl(
      conversationId,
      "video",
      { storagePath: videoStoragePath, publicUrl: videoPublicUrl },
      videoDataUrl
    );

    const { data: turns } = await supabaseAdmin
      .from("agent_conversation_turns")
      .select("turn_index, role, content")
      .eq("conversation_id", conversationId)
      .order("turn_index", { ascending: true });

    const existingTurns = (turns ?? []) as { turn_index: number; role: string; content: string }[];
    const isFirstMessage = existingTurns.length === 0;
    const lastAgentContent = existingTurns.length > 0
      ? [...existingTurns].reverse().find((t) => t.role === "agent")?.content ?? ""
      : "";
    const isVoiceVideoQuestion =
      /record/.test(lastAgentContent) && (/voice|video/.test(lastAgentContent));
    const { data: eventBriefRow } = await supabaseAdmin
      .from("events")
      .select("agent_brief")
      .eq("id", conv.event_id)
      .single();
    const briefForValidation = (eventBriefRow as { agent_brief?: Record<string, unknown> } | null)
      ?.agent_brief ?? null;
    const needsEmailCaptcha = requiresEmailCaptcha(briefForValidation, lastAgentContent);

    let userTurn: Record<string, unknown> | null = null;

    if (isFirstMessage && content === "") {
      const { data: eventRow } = await supabaseAdmin
        .from("events")
        .select("id, title, agent_theme_id, agent_brief, song_garden_config")
        .eq("id", conv.event_id)
        .single();
      let eventData: {
        id: string;
        title: string;
        agent_theme_id: string | null;
        agent_brief: unknown;
        song_garden_config: SongGardenConfig | null;
      } | null = eventRow as typeof eventRow;
      if (USE_LOCAL_EVENTS && (conv.local_event_id || !eventData)) {
        const localId = conv.local_event_id ?? conv.event_id;
        if (localId) {
          const local = localEventsGetById(localId);
          if (local) {
            eventData = {
              id: local.id,
              title: local.title,
              agent_theme_id: local.agent_theme_id,
              agent_brief: local.agent_brief,
              song_garden_config: (local.song_garden_config as SongGardenConfig | null) ?? null,
            };
          }
        }
      }
      if (!eventData) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
      }

      const managedJourney =
        journeyManagedRequested &&
        eventHasManagedJourney(eventData.song_garden_config, null);

      if (managedJourney) {
        await supabaseAdmin
          .from("agent_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);

        return NextResponse.json({
          turn: null,
          nextMessage: {
            ...JOURNEY_MANAGED_STUB,
            suggestedAnswerTypes: ["text"],
          },
        });
      }

      const { data: themeRow } = await supabaseAdmin
        .from("agent_themes")
        .select("system_prompt_template, max_questions, do_dont_rules")
        .eq("id", eventData.agent_theme_id)
        .single();
      const theme = themeRow
        ? {
            system_prompt_template: themeRow.system_prompt_template,
            max_questions: themeRow.max_questions,
            do_dont_rules: themeRow.do_dont_rules ?? [],
          }
        : DEFAULT_THEME;
      const brief = eventData.agent_brief as Record<string, unknown> | null;

      const nextResult = await getNextAgentMessage(new OpenAI({ apiKey }), {
        theme,
        brief: brief
          ? {
              eventName: brief.eventName as string | undefined,
              eventType: brief.eventType as string | undefined,
              whoWhat: brief.whoWhat as string | undefined,
              emotionalArc: brief.emotionalArc as string | undefined,
              askAbout: brief.askAbout as string[] | undefined,
              askAboutItems: brief.askAboutItems as Array<{
                prompt: string;
                allowAudio?: boolean;
                allowVideo?: boolean;
                allowMedia?: boolean;
                requireEmailCaptcha?: boolean;
              }> | undefined,
              collectName: brief.collectName as boolean | undefined,
              nameQuestionPrompt: brief.nameQuestionPrompt as string | undefined,
              avoid: brief.avoid as string[] | undefined,
              exampleAnswers: brief.exampleAnswers as string[] | undefined,
            }
          : null,
        eventTitle: eventData.title ?? "",
        conversationHistory: [],
        participantName: null,
        currentStep: 1,
      });

      const { data: agentTurnRow, error: eAgent } = await supabaseAdmin
        .from("agent_conversation_turns")
        .insert({
          conversation_id: conversationId,
          turn_index: 0,
          role: "agent",
          content: nextResult.agentMessage,
        })
        .select()
        .single();
      if (eAgent || !agentTurnRow) {
        return NextResponse.json({ error: eAgent?.message ?? "Failed to save." }, { status: 400 });
      }
      await supabaseAdmin
        .from("agent_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      return NextResponse.json({
        turn: null,
        nextMessage: {
          agentMessage: nextResult.agentMessage,
          suggestedAnswerTypes: nextResult.suggestedAnswerTypes,
          extractedTags: nextResult.extractedTags,
          stopReason: nextResult.stopReason,
        },
        agentTurn: rowToTurn(agentTurnRow),
      });
    }

    let managedFirstUserTurn = false;
    if (isFirstMessage && content !== "") {
      const { data: firstEventRow } = await supabaseAdmin
        .from("events")
        .select("id, song_garden_config")
        .eq("id", conv.event_id)
        .single();
      let firstEventConfig = (firstEventRow as { song_garden_config?: SongGardenConfig | null } | null)
        ?.song_garden_config ?? null;
      if (USE_LOCAL_EVENTS && conv.local_event_id) {
        const local = localEventsGetById(conv.local_event_id);
        if (local) {
          firstEventConfig = (local.song_garden_config as SongGardenConfig | null) ?? null;
        }
      }
      const managedOk =
        journeyManagedRequested && eventHasManagedJourney(firstEventConfig, null);
      if (!managedOk) {
        return NextResponse.json(
          { error: "Unexpected message before interview started." },
          { status: 400 }
        );
      }
      managedFirstUserTurn = true;
    }

    if (!isFirstMessage || managedFirstUserTurn) {
      const journeyNameStep = body.journeyNameStep === true;
      const isNameQuestion =
        isNameQuestionPrompt(briefForValidation, lastAgentContent) ||
        (managedFirstUserTurn && journeyNameStep);
      if (isNameQuestion && !content) {
        return NextResponse.json({ error: "Please enter a name." }, { status: 400 });
      }
      if (!content && !hasTurnMedia(body) && !isVoiceVideoQuestion) {
        return NextResponse.json({
          turn: null,
          nextMessage: {
            agentMessage: lastAgentContent,
            suggestedAnswerTypes: ["text"],
            extractedTags: undefined,
            stopReason: "continue",
          },
          agentTurn: null,
        });
      }
      if (needsEmailCaptcha) {
        if (!validEmail(content)) {
          return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
        }
        const captcha = await verifyEmailStepCaptcha(request, captchaToken);
        if (!captcha.ok) {
          return NextResponse.json({ error: captcha.error }, { status: 400 });
        }
        // Email is stored on the user turn below; participant.email column may not exist yet in prod.
      }
      if (isNameQuestion && content) {
        await supabaseAdmin
          .from("agent_participants")
          .update(participantNameUpdatePayload(content))
          .eq("id", conv.participant_id);
      }
      const nextIndex = existingTurns.length;
      const { data: inserted, error: eInsert } = await supabaseAdmin
        .from("agent_conversation_turns")
        .insert({
          conversation_id: conversationId,
          turn_index: nextIndex,
          role: "user",
          content,
          audio_url: storedAudioUrl,
          video_url: storedVideoUrl,
        })
        .select()
        .single();
      if (eInsert || !inserted) {
        return NextResponse.json({ error: eInsert?.message ?? "Failed to save message." }, { status: 400 });
      }
      userTurn = inserted;
      scheduleTranscriptionIfMediaPresent({
        turnId: inserted.id as string,
        audioUrl: storedAudioUrl,
        videoUrl: storedVideoUrl,
        mode: "supabase",
      });
    }

    const history = existingTurns.map((t) => ({ role: t.role as "agent" | "user", content: t.content }));
    if (userTurn) {
      history.push({ role: "user" as const, content });
    }

    /* currentStep = which agent message we're generating next (1 = first scripted Q, ... then done) */
    const agentCount = existingTurns.filter((t) => t.role === "agent").length;
    const currentStep = agentCount + 1;

    const { data: eventRow } = await supabaseAdmin
      .from("events")
      .select("id, title, agent_theme_id, agent_brief, song_garden_config")
      .eq("id", conv.event_id)
      .single();
    let eventData: {
      id: string;
      title: string;
      agent_theme_id: string | null;
      agent_brief: unknown;
      song_garden_config: SongGardenConfig | null;
    } | null = eventRow as typeof eventRow;
    if (USE_LOCAL_EVENTS && (conv.local_event_id || !eventData)) {
      const localId = conv.local_event_id ?? conv.event_id;
      if (localId) {
        const local = localEventsGetById(localId);
        if (local)
          eventData = {
            id: local.id,
            title: local.title,
            agent_theme_id: local.agent_theme_id,
            agent_brief: local.agent_brief,
            song_garden_config: (local.song_garden_config as SongGardenConfig | null) ?? null,
          };
      }
    }
    if (!eventData) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const managedJourney =
      journeyManagedRequested &&
      eventHasManagedJourney(eventData.song_garden_config, null);

    if (managedJourney && userTurn != null) {
      const eventIdForGarden = String(
        (USE_LOCAL_EVENTS && conv.local_event_id ? conv.local_event_id : null) ||
          conv.event_id ||
          eventData.id
      );
      const gardenFields = await gardenPayloadForTurn({
        eventId: eventIdForGarden,
        turnId: String((userTurn as { id: string }).id),
        content,
        hasAudio: Boolean(storedAudioUrl || audioDataUrl),
        hasVideo: Boolean(storedVideoUrl || videoDataUrl),
        deviceId,
      });

      await supabaseAdmin
        .from("agent_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      return NextResponse.json({
        turn: userTurn ? rowToTurn(userTurn) : null,
        nextMessage: {
          ...JOURNEY_MANAGED_STUB,
          suggestedAnswerTypes: ["text"],
        },
        ...gardenFields,
      });
    }

    const { data: themeRow } = await supabaseAdmin
      .from("agent_themes")
      .select("system_prompt_template, max_questions, do_dont_rules")
      .eq("id", eventData.agent_theme_id)
      .single();
    const theme = themeRow
      ? {
          system_prompt_template: themeRow.system_prompt_template,
          max_questions: themeRow.max_questions,
          do_dont_rules: themeRow.do_dont_rules ?? [],
        }
      : DEFAULT_THEME;

    const { data: participantRow } = await supabaseAdmin
      .from("agent_participants")
      .select("name")
      .eq("id", conv.participant_id)
      .single();

    const brief = eventData.agent_brief as Record<string, unknown> | null;
    const nextResult = await getNextAgentMessage(new OpenAI({ apiKey }), {
      theme,
      brief: brief ? {
        eventName: brief.eventName as string | undefined,
        eventType: brief.eventType as string | undefined,
        whoWhat: brief.whoWhat as string | undefined,
        emotionalArc: brief.emotionalArc as string | undefined,
        askAbout: brief.askAbout as string[] | undefined,
        askAboutItems: brief.askAboutItems as Array<{
          prompt: string;
          allowAudio?: boolean;
          allowVideo?: boolean;
          allowMedia?: boolean;
        }> | undefined,
        collectName: brief.collectName as boolean | undefined,
        nameQuestionPrompt: brief.nameQuestionPrompt as string | undefined,
        avoid: brief.avoid as string[] | undefined,
        exampleAnswers: brief.exampleAnswers as string[] | undefined,
      } : null,
      eventTitle: eventData.title ?? "",
      conversationHistory: history,
      participantName: participantDisplayName(participantRow) ?? null,
      currentStep,
    });

    const agentTurnIndex = isFirstMessage ? 0 : existingTurns.length + 1;
    const { data: agentTurnRow, error: eAgent } = await supabaseAdmin
      .from("agent_conversation_turns")
      .insert({
        conversation_id: conversationId,
        turn_index: agentTurnIndex,
        role: "agent",
        content: nextResult.agentMessage,
      })
      .select()
      .single();
    if (eAgent || !agentTurnRow) {
      return NextResponse.json({ error: eAgent?.message ?? "Failed to save agent message." }, { status: 400 });
    }

    await supabaseAdmin
      .from("agent_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    const eventIdForGarden = String(
      (USE_LOCAL_EVENTS && conv.local_event_id ? conv.local_event_id : null) ||
        conv.event_id ||
        eventData.id
    );
    const gardenFields =
      userTurn != null
        ? await gardenPayloadForTurn({
            eventId: eventIdForGarden,
            turnId: String((userTurn as { id: string }).id),
            content,
            hasAudio: Boolean(storedAudioUrl || audioDataUrl),
            hasVideo: Boolean(storedVideoUrl || videoDataUrl),
            deviceId,
          })
        : {
            gardenEffects: null,
            gardenCelebrationLine: null,
            gardenWorldVersion: null,
          };

    return NextResponse.json({
      turn: userTurn ? rowToTurn(userTurn) : null,
      nextMessage: {
        agentMessage: nextResult.agentMessage,
        suggestedAnswerTypes: nextResult.suggestedAnswerTypes,
        extractedTags: nextResult.extractedTags,
        stopReason: nextResult.stopReason,
      },
      agentTurn: rowToTurn(agentTurnRow),
      ...gardenFields,
    });
  } catch (err) {
    console.error("Agent send error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
