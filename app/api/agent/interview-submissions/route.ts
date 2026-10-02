import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { localGetEventTranscripts } from "@/lib/local-agent-interview-store";
import {
  AGENT_PARTICIPANT_IDENTITY_SELECT,
  participantDisplayName,
} from "@/lib/agent-participant-db";
import {
  fillMissingJourneyQuestions,
  pairInterviewAnswers,
  type PairedInterviewAnswer,
} from "@/lib/agent-interview-qa";
import { proxiedAgentMediaUrl } from "@/lib/agent-media/storage-upload";
import { localEventsGetById } from "@/lib/local-events-store";
import type { Event } from "@/data/mockEvents";
import type { SongGardenConfig } from "@/lib/songgarden/config";
import {
  contributionQuestionPrompts,
  resolveJourneySteps,
} from "@/lib/songgarden/journey-steps";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

type InterviewSubmissionItem = {
  participantName: string;
  email?: string | null;
  conversationId: string;
  answers: PairedInterviewAnswer[];
};

/** Point Composer at the same-origin media proxy (private Storage buckets otherwise 403). */
function questionPromptsForEvent(config: {
  agentBrief?: unknown;
  songGardenConfig?: SongGardenConfig | null;
}): string[] {
  const eventLike = {
    agentBrief: config.agentBrief ?? null,
    songGardenConfig: config.songGardenConfig ?? null,
  } as Event;
  return contributionQuestionPrompts(resolveJourneySteps(eventLike));
}

function withJourneyQuestions(
  answers: PairedInterviewAnswer[],
  prompts: string[]
): PairedInterviewAnswer[] {
  return fillMissingJourneyQuestions(withProxiedMediaUrls(answers), prompts);
}

function withProxiedMediaUrls(answers: PairedInterviewAnswer[]): PairedInterviewAnswer[] {
  return answers.map((a) => ({
    ...a,
    audioUrl: proxiedAgentMediaUrl(a.audioUrl),
    videoUrl: proxiedAgentMediaUrl(a.videoUrl),
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId is required." }, { status: 400 });

  if (USE_LOCAL_EVENTS) {
    const localEvent = localEventsGetById(eventId);
    const prompts = localEvent
      ? questionPromptsForEvent({
          agentBrief: localEvent.agent_brief,
          songGardenConfig: (localEvent.song_garden_config as SongGardenConfig | null) ?? null,
        })
      : [];
    const transcripts = await localGetEventTranscripts(eventId);
    const items: InterviewSubmissionItem[] = transcripts.map((t) => ({
      participantName: t.participantName,
      email: t.email ?? null,
      conversationId: t.conversationId,
      answers: withJourneyQuestions(pairInterviewAnswers(t.turns), prompts),
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

    const { data: eventRow } = await supabaseAdmin
      .from("events")
      .select("agent_brief, song_garden_config")
      .eq("id", eventId)
      .maybeSingle();
    const prompts = questionPromptsForEvent({
      agentBrief: eventRow?.agent_brief,
      songGardenConfig: (eventRow?.song_garden_config as SongGardenConfig | null) ?? null,
    });

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
        "id, conversation_id, turn_index, role, content, created_at, audio_url, video_url, audio_transcript, video_transcript"
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

    const items: InterviewSubmissionItem[] = convs.map((conv: { id: string; participant_id: string }) => {
      const convTurns = turnsByConv.get(conv.id) ?? [];
      return {
        participantName: identityById.get(conv.participant_id)?.name ?? "Anonymous",
        conversationId: conv.id,
        email: identityById.get(conv.participant_id)?.email ?? null,
        answers: withJourneyQuestions(pairInterviewAnswers(convTurns), prompts),
      };
    });

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
