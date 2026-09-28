import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { localGetEventTranscripts } from "@/lib/local-agent-interview-store";
import {
  AGENT_PARTICIPANT_IDENTITY_SELECT,
  participantDisplayName,
} from "@/lib/agent-participant-db";
import { pairInterviewAnswers, type PairedInterviewAnswer } from "@/lib/agent-interview-qa";
import { proxiedAgentMediaUrl } from "@/lib/agent-media/storage-upload";
import {
  attributeMissingAnswerPrompts,
  catalogPromptsForAnswers,
  contributionPromptsForComposer,
} from "@/lib/composer/attribute-journey-prompts";
import { localEventsGetById } from "@/lib/local-events-store";
import type { AgentBrief } from "@/data/agentInterview";
import type { SongGardenConfig } from "@/lib/songgarden/config";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

type InterviewSubmissionItem = {
  participantName: string;
  email?: string | null;
  conversationId: string;
  answers: PairedInterviewAnswer[];
};

/** Point Composer at the same-origin media proxy (private Storage buckets otherwise 403). */
function withProxiedMediaUrls<T extends PairedInterviewAnswer>(answers: T[]): T[] {
  return answers.map((a) => ({
    ...a,
    audioUrl: proxiedAgentMediaUrl(a.audioUrl),
    videoUrl: proxiedAgentMediaUrl(a.videoUrl),
  }));
}

async function promptsForEvent(eventId: string): Promise<string[]> {
  if (USE_LOCAL_EVENTS) {
    const local = localEventsGetById(eventId);
    if (!local) return [];
    const config = (local.song_garden_config as SongGardenConfig | null) ?? null;
    return contributionPromptsForComposer({
      journeySteps: config?.journeySteps,
      songGardenConfig: config,
      agentBrief: (local.agent_brief as AgentBrief | null) ?? null,
    });
  }

  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from("events")
    .select("agent_brief, song_garden_config")
    .eq("id", eventId)
    .maybeSingle();
  const config = (data?.song_garden_config as SongGardenConfig | null) ?? null;
  return contributionPromptsForComposer({
    journeySteps: config?.journeySteps,
    songGardenConfig: config,
    agentBrief: (data?.agent_brief as AgentBrief | null) ?? null,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId is required." }, { status: 400 });

  if (USE_LOCAL_EVENTS) {
    const transcripts = await localGetEventTranscripts(eventId);
    const paired = transcripts.map((t) => pairInterviewAnswers(t.turns));
    const prompts = catalogPromptsForAnswers(await promptsForEvent(eventId), paired);
    const items: InterviewSubmissionItem[] = transcripts.map((t, index) => ({
      participantName: t.participantName,
      email: t.email ?? null,
      conversationId: t.conversationId,
      answers: withProxiedMediaUrls(attributeMissingAnswerPrompts(paired[index], prompts)),
    }));

    return NextResponse.json({ items });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  try {
    const { data: convs, error: eConvs } = await supabaseAdmin
      .from("agent_conversations")
      .select("id, participant_id")
      .eq("event_id", eventId);
    if (eConvs || !Array.isArray(convs)) {
      console.error("[interview-submissions] agent_conversations query failed:", eConvs?.message);
      return NextResponse.json({ items: [] });
    }
    if (convs.length === 0) return NextResponse.json({ items: [] });

    const participantIds = convs.map((c: { participant_id: string }) => c.participant_id);
    const { data: participants } = await supabaseAdmin
      .from("agent_participants")
      .select(AGENT_PARTICIPANT_IDENTITY_SELECT)
      .in("id", participantIds);

    const identityById = new Map<string, { name: string; email: string | null }>(
      (participants ?? []).map((p: { id: string; name: string | null; display_name?: string | null }) => [
        p.id,
        {
          name: participantDisplayName(p) ?? "Anonymous",
          email: null,
        },
      ])
    );

    const conversationIds = convs.map((c: { id: string }) => c.id);
    const { data: turns, error: eTurns } = await supabaseAdmin
      .from("agent_conversation_turns")
      .select(
        "conversation_id, turn_index, role, content, created_at, audio_url, video_url, audio_transcript, video_transcript"
      )
      .in("conversation_id", conversationIds);
    if (eTurns || !Array.isArray(turns)) {
      console.error("[interview-submissions] agent_conversation_turns query failed:", eTurns?.message);
      return NextResponse.json({ items: [] });
    }

    const turnsByConv = new Map<string, typeof turns>();
    for (const t of turns) {
      const list = turnsByConv.get(t.conversation_id) ?? [];
      list.push(t);
      turnsByConv.set(t.conversation_id, list);
    }

    const paired = convs.map((conv: { id: string }) =>
      pairInterviewAnswers(turnsByConv.get(conv.id) ?? [])
    );
    const prompts = catalogPromptsForAnswers(await promptsForEvent(eventId), paired);
    const items: InterviewSubmissionItem[] = convs.map((conv: { id: string; participant_id: string }, index: number) => {
      return {
        participantName: identityById.get(conv.participant_id)?.name ?? "Anonymous",
        conversationId: conv.id,
        email: identityById.get(conv.participant_id)?.email ?? null,
        answers: withProxiedMediaUrls(attributeMissingAnswerPrompts(paired[index], prompts)),
      };
    });

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
