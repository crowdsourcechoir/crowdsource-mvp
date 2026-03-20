import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import OpenAI from "openai";
import { getNextAgentMessage } from "@/lib/agent-llm";
import { localEventsGetById } from "@/lib/local-events-store";
import {
  localGetConversation,
  localInsertTurn,
  localGetParticipant,
  localUpdateParticipantName,
} from "@/lib/local-agent-interview-store";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

function rowToTurn(row: Record<string, unknown>) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    turnIndex: row.turn_index,
    role: row.role,
    content: row.content,
    audioUrl: row.audio_url ?? null,
    videoUrl: row.video_url ?? null,
    createdAt: row.created_at,
  };
}

const FIRST_QUESTION = "What's your name?";
const DEFAULT_THEME = {
  system_prompt_template:
    "You are a warm, friendly host at an event. Ask one short, casual question at a time. Draw out memories, shoutouts, and wishes. Use the event context and brief to personalize. Keep it conversational and do not collect sensitive personal info.",
  max_questions: 8,
  do_dont_rules: [] as string[],
};
const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "agent-media";
let mediaBucketChecked = false;

function extFromMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  return "bin";
}

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string; extension: string } {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid media format.");
  const contentType = match[1];
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

      const isNameQuestion =
        !isFirstMessage &&
        existingTurns.length === 1 &&
        existingTurns[0].role === "agent" &&
        /name/i.test(lastAgentContent);

      const DEFAULT_THEME = {
        system_prompt_template:
          "You are a warm, friendly host at an event. Ask one short, casual question at a time. Draw out memories and wishes from the participant. Use the event context and any provided brief to personalize. Do not collect sensitive personal info. Keep questions conversational and high-signal.",
        max_questions: 8,
        do_dont_rules: [] as string[],
      };

      let userTurn: { id: string; conversationId: string; turnIndex: number; role: "agent" | "user"; content: string; audioUrl: string | null; videoUrl: string | null; createdAt: string } | null =
        null;

      if (isFirstMessage) {
        const firstAgentTurn = await localInsertTurn({
          conversationId,
          turnIndex: 0,
          role: "agent",
          content: FIRST_QUESTION,
        });

        if (content === "") {
          // Important: the client triggers the first agent turn by calling sendMessage(..., "").
          // That call should NOT be treated as "skip name"—it should only initialize the name question.
          return NextResponse.json({
            turn: null,
            nextMessage: {
              agentMessage: FIRST_QUESTION,
              suggestedAnswerTypes: ["text"],
              extractedTags: undefined,
              stopReason: "continue",
            },
            agentTurn: {
              id: firstAgentTurn.id,
              conversationId: firstAgentTurn.conversationId,
              turnIndex: firstAgentTurn.turnIndex,
              role: "agent",
              content: firstAgentTurn.content,
              audioUrl: firstAgentTurn.audioUrl,
              videoUrl: firstAgentTurn.videoUrl,
              createdAt: firstAgentTurn.createdAt,
            },
          });
        }

        // User sent their name (or any text): add user turn and return the next question.
        const userInserted = await localInsertTurn({
          conversationId,
          turnIndex: 1,
          role: "user",
          content,
        });
        userTurn = {
          id: userInserted.id,
          conversationId,
          turnIndex: userInserted.turnIndex,
          role: "user",
          content: userInserted.content,
          audioUrl: userInserted.audioUrl,
          videoUrl: userInserted.videoUrl,
          createdAt: userInserted.createdAt,
        };

        await localUpdateParticipantName({ participantId: local.conversation.participantId, name: content });

        const nextResult = await getNextAgentMessage(new OpenAI({ apiKey }), {
          theme: DEFAULT_THEME,
          brief: eventData.agent_brief ? (eventData.agent_brief as any) : null,
          eventTitle: eventData.title,
          conversationHistory: [
            { role: "agent" as const, content: FIRST_QUESTION },
            { role: "user" as const, content },
          ],
          participantName: content,
          currentStep: 2,
        });

        const nextAgentTurn = await localInsertTurn({
          conversationId,
          turnIndex: 2,
          role: "agent",
          content: nextResult.agentMessage,
        });

        return NextResponse.json({
          turn: userTurn,
          nextMessage: {
            agentMessage: nextResult.agentMessage,
            suggestedAnswerTypes: nextResult.suggestedAnswerTypes,
            extractedTags: nextResult.extractedTags,
            stopReason: nextResult.stopReason,
          },
          agentTurn: {
            id: nextAgentTurn.id,
            conversationId: nextAgentTurn.conversationId,
            turnIndex: nextAgentTurn.turnIndex,
            role: "agent",
            content: nextAgentTurn.content,
            audioUrl: nextAgentTurn.audioUrl,
            videoUrl: nextAgentTurn.videoUrl,
            createdAt: nextAgentTurn.createdAt,
          },
        });
      }

      // Subsequent user messages.
      if (!content && !audioDataUrl && !videoDataUrl && !isVoiceVideoQuestion) {
        if (!isNameQuestion) {
          // Empty submit: no error banner — just keep the same question visible.
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
        // Empty name = skip / anonymous; fall through and insert empty user turn.
      }

      const userTurnInserted = await localInsertTurn({
        conversationId,
        turnIndex: existingTurns.length,
        role: "user",
        content,
        audioUrl: audioDataUrl,
        videoUrl: videoDataUrl,
      });

      const agentCount = existingTurns.filter((t) => t.role === "agent").length;
      const currentStep = agentCount + 1;

      const participant = await localGetParticipant(local.conversation.participantId);
      const participantName = participant?.name ?? null;

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
          createdAt: agentTurnInserted.createdAt,
        },
      });
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
    const storedAudioUrl = await persistMedia(conversationId, "audio", audioDataUrl);
    const storedVideoUrl = await persistMedia(conversationId, "video", videoDataUrl);

    const { data: conv, error: eConv } = await supabaseAdmin
      .from("agent_conversations")
      .select("id, event_id, local_event_id, participant_id")
      .eq("id", conversationId)
      .single();
    if (eConv || !conv) {
      if (eConv?.code === "PGRST116") return NextResponse.json(null, { status: 404 });
      return NextResponse.json({ error: eConv?.message ?? "Not found" }, { status: 500 });
    }

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
    const isNameQuestion =
      !isFirstMessage &&
      existingTurns.length === 1 &&
      existingTurns[0].role === "agent" &&
      /name/i.test(lastAgentContent);

    let userTurn: Record<string, unknown> | null = null;

    if (isFirstMessage) {
      /* First question is always the name question */
      const { data: agentTurnRow, error: eAgent } = await supabaseAdmin
        .from("agent_conversation_turns")
        .insert({
          conversation_id: conversationId,
          turn_index: 0,
          role: "agent",
          content: FIRST_QUESTION,
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

      /* Important: the client triggers the first agent turn by calling sendMessage(..., "").
         That call should NOT be treated as "skip name"—it should only initialize the name question. */
      if (content === "") {
        return NextResponse.json({
          turn: null,
          nextMessage: {
            agentMessage: FIRST_QUESTION,
            suggestedAnswerTypes: ["text"],
            extractedTags: undefined,
            stopReason: "continue",
          },
          agentTurn: rowToTurn(agentTurnRow),
        });
      }

      /* User sent their name (or any text): add user turn and return next question */
      const { data: userTurnRow, error: eUser } = await supabaseAdmin
        .from("agent_conversation_turns")
        .insert({
          conversation_id: conversationId,
          turn_index: 1,
          role: "user",
          content,
        })
        .select()
        .single();
      if (eUser || !userTurnRow) {
        return NextResponse.json({
          turn: null,
          nextMessage: {
            agentMessage: FIRST_QUESTION,
            suggestedAnswerTypes: ["text"],
            extractedTags: undefined,
            stopReason: "continue",
          },
          agentTurn: rowToTurn(agentTurnRow),
        });
      }
      await supabaseAdmin
        .from("agent_participants")
        .update({ name: content })
        .eq("id", conv.participant_id);

      const { data: eventRow } = await supabaseAdmin
        .from("events")
        .select("id, title, agent_theme_id, agent_brief")
        .eq("id", conv.event_id)
        .single();
      let eventData: { id: string; title: string; agent_theme_id: string | null; agent_brief: unknown } | null = eventRow as typeof eventRow;
      if (USE_LOCAL_EVENTS && (conv.local_event_id || !eventData)) {
        const localId = conv.local_event_id ?? conv.event_id;
        if (localId) {
          const local = localEventsGetById(localId);
          if (local)
            eventData = { id: local.id, title: local.title, agent_theme_id: local.agent_theme_id, agent_brief: local.agent_brief };
        }
      }
      if (!eventData) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
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
        brief: brief ? {
          eventName: brief.eventName as string | undefined,
          eventType: brief.eventType as string | undefined,
          whoWhat: brief.whoWhat as string | undefined,
          emotionalArc: brief.emotionalArc as string | undefined,
          askAbout: brief.askAbout as string[] | undefined,
          avoid: brief.avoid as string[] | undefined,
          exampleAnswers: brief.exampleAnswers as string[] | undefined,
        } : null,
        eventTitle: eventData.title ?? "",
        conversationHistory: [
          { role: "agent" as const, content: FIRST_QUESTION },
          { role: "user" as const, content },
        ],
        participantName: content,
        currentStep: 2,
      });
      const { data: nextAgentRow, error: eNext } = await supabaseAdmin
        .from("agent_conversation_turns")
        .insert({
          conversation_id: conversationId,
          turn_index: 2,
          role: "agent",
          content: nextResult.agentMessage,
        })
        .select()
        .single();
      if (eNext || !nextAgentRow) {
        return NextResponse.json({
          turn: rowToTurn(userTurnRow),
          nextMessage: nextResult,
          agentTurn: null,
        });
      }
      await supabaseAdmin
        .from("agent_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
      return NextResponse.json({
        turn: rowToTurn(userTurnRow),
        nextMessage: {
          agentMessage: nextResult.agentMessage,
          suggestedAnswerTypes: nextResult.suggestedAnswerTypes,
          extractedTags: nextResult.extractedTags,
          stopReason: nextResult.stopReason,
        },
        agentTurn: rowToTurn(nextAgentRow),
      });
    }
    if (!isFirstMessage) {
      if (!content && !audioDataUrl && !videoDataUrl && !isVoiceVideoQuestion) {
        if (!isNameQuestion) {
          // Empty submit: no error banner — just keep the same question visible.
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
        // Empty name = skip / anonymous; fall through and insert empty user turn.
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
      if (isNameQuestion && content) {
        await supabaseAdmin
          .from("agent_participants")
          .update({ name: content })
          .eq("id", conv.participant_id);
      }
    }

    const history = existingTurns.map((t) => ({ role: t.role as "agent" | "user", content: t.content }));
    if (userTurn) {
      history.push({ role: "user" as const, content });
    }

    /* currentStep = which agent message we're generating (1 = name, 2 = first fixed Q, … 8 = voice, 9 = done) */
    const agentCount = existingTurns.filter((t) => t.role === "agent").length;
    const currentStep = agentCount + 1;

    const { data: eventRow } = await supabaseAdmin
      .from("events")
      .select("id, title, agent_theme_id, agent_brief")
      .eq("id", conv.event_id)
      .single();
    let eventData: { id: string; title: string; agent_theme_id: string | null; agent_brief: unknown } | null = eventRow as typeof eventRow;
    if (USE_LOCAL_EVENTS && (conv.local_event_id || !eventData)) {
      const localId = conv.local_event_id ?? conv.event_id;
      if (localId) {
        const local = localEventsGetById(localId);
        if (local)
          eventData = { id: local.id, title: local.title, agent_theme_id: local.agent_theme_id, agent_brief: local.agent_brief };
      }
    }
    if (!eventData) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
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
        avoid: brief.avoid as string[] | undefined,
        exampleAnswers: brief.exampleAnswers as string[] | undefined,
      } : null,
      eventTitle: eventData.title ?? "",
      conversationHistory: history,
      participantName: participantRow?.name ?? null,
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

    return NextResponse.json({
      turn: userTurn ? rowToTurn(userTurn) : null,
      nextMessage: {
        agentMessage: nextResult.agentMessage,
        suggestedAnswerTypes: nextResult.suggestedAnswerTypes,
        extractedTags: nextResult.extractedTags,
        stopReason: nextResult.stopReason,
      },
      agentTurn: rowToTurn(agentTurnRow),
    });
  } catch (err) {
    console.error("Agent send error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
