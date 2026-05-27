import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { localGetEventTranscripts } from "@/lib/local-agent-interview-store";
import {
  AGENT_PARTICIPANT_IDENTITY_SELECT,
  participantDisplayName,
} from "@/lib/agent-participant-db";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

type InterviewAnswer = {
  createdAt: string;
  content: string;
  audioUrl?: string | null;
  videoUrl?: string | null;
  audioTranscript?: string | null;
  videoTranscript?: string | null;
};

type InterviewSubmissionItem = {
  participantName: string;
  email?: string | null;
  conversationId: string;
  answers: InterviewAnswer[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId is required." }, { status: 400 });

  if (USE_LOCAL_EVENTS) {
    const transcripts = await localGetEventTranscripts(eventId);
    const items: InterviewSubmissionItem[] = transcripts.map((t) => ({
      participantName: t.participantName,
      email: t.email ?? null,
      conversationId: t.conversationId,
      answers: t.turns
        .filter((turn) => turn.role === "user")
        .map((turn) => ({
          createdAt: turn.createdAt,
          content: turn.content,
          audioUrl: turn.audioUrl ?? null,
          videoUrl: turn.videoUrl ?? null,
          audioTranscript: turn.audioTranscript ?? null,
          videoTranscript: turn.videoTranscript ?? null,
        })),
    }));

    return NextResponse.json({ items });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  try {
    // Load conversations for the event.
    const { data: convs, error: eConvs } = await supabaseAdmin
      .from("agent_conversations")
      .select("id, participant_id")
      .eq("event_id", eventId);
    if (eConvs || !Array.isArray(convs)) {
      console.error("[interview-submissions] agent_conversations query failed:", eConvs?.message);
      return NextResponse.json({ items: [] });
    }
    if (convs.length === 0) return NextResponse.json({ items: [] });

    const participantIds = convs.map((c: any) => c.participant_id);
    const { data: participants, error: eParticipants } = await supabaseAdmin
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

    const conversationIds = convs.map((c: any) => c.id);
    const { data: turns, error: eTurns } = await supabaseAdmin
      .from("agent_conversation_turns")
      .select("conversation_id, turn_index, role, content, created_at, audio_url, video_url, audio_transcript, video_transcript")
      .in("conversation_id", conversationIds);
    if (eTurns || !Array.isArray(turns)) {
      console.error("[interview-submissions] agent_conversation_turns query failed:", eTurns?.message);
      return NextResponse.json({ items: [] });
    }

    const turnsByConv = new Map<string, any[]>();
    for (const t of turns) {
      const list = turnsByConv.get(t.conversation_id) ?? [];
      list.push(t);
      turnsByConv.set(t.conversation_id, list);
    }

    const items: InterviewSubmissionItem[] = convs.map((conv: any) => {
      const convTurns = (turnsByConv.get(conv.id) ?? []).sort((a: any, b: any) => a.turn_index - b.turn_index);
      const answers = convTurns
        .filter((t: any) => t.role === "user")
        .map((t: any) => ({
          createdAt: t.created_at,
          content: t.content,
          audioUrl: t.audio_url ?? null,
          videoUrl: t.video_url ?? null,
          audioTranscript: t.audio_transcript ?? null,
          videoTranscript: t.video_transcript ?? null,
        }));
      return {
        participantName: identityById.get(conv.participant_id)?.name ?? "Anonymous",
        conversationId: conv.id,
        email: identityById.get(conv.participant_id)?.email ?? null,
        answers,
      };
    });

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

