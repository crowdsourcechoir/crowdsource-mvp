import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSignalChoiceDeviceId,
  parsePromptBlock,
  signalChoiceDeviceId,
  type SignalPromptBlock,
} from "@/data/signalPromptBlock";
import { localGetEventTranscripts } from "@/lib/local-agent-interview-store";
import { supabaseAdmin } from "@/lib/supabase-server";
import type {
  CompositionGatherResult,
  CompositionPhraseCard,
  CompositionTextLine,
  CompositionTranscriptSegment,
  GatherCompositionInputsOptions,
  SignalResolution,
} from "@/lib/composition/types";

function isSpam(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 2) return true;
  if (/^(.)\1{20,}$/.test(t)) return true;
  if (/^[^a-z0-9]+$/i.test(t)) return true;
  return false;
}

type ResolvedScope = {
  eventId: string | null;
  sessionIds: string[];
};

async function resolveScope(
  db: SupabaseClient,
  options: GatherCompositionInputsOptions
): Promise<ResolvedScope> {
  const requestedEventId =
    typeof options.eventId === "string" && options.eventId.trim() ? options.eventId.trim() : null;
  const requestedSessionId =
    typeof options.sessionId === "string" && options.sessionId.trim() ? options.sessionId.trim() : null;

  if (!requestedEventId && !requestedSessionId) {
    throw new Error("At least one of eventId or sessionId is required.");
  }

  const sessionIds = new Set<string>();
  let linkedEventId: string | null = requestedEventId;

  if (requestedSessionId) {
    sessionIds.add(requestedSessionId);
    const { data: session, error } = await db
      .from("prompt_game_sessions")
      .select("id, linked_event_id")
      .eq("id", requestedSessionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (session?.linked_event_id) {
      linkedEventId = linkedEventId ?? session.linked_event_id;
    }
  }

  if (linkedEventId) {
    const { data: linkedSessions, error } = await db
      .from("prompt_game_sessions")
      .select("id")
      .eq("linked_event_id", linkedEventId);
    if (error) throw new Error(error.message);
    for (const row of linkedSessions ?? []) {
      sessionIds.add(row.id);
    }
  }

  return {
    eventId: linkedEventId,
    sessionIds: Array.from(sessionIds),
  };
}

async function gatherInterviewInputs(
  eventId: string
): Promise<{ textLines: CompositionTextLine[]; transcriptSegments: CompositionTranscriptSegment[] }> {
  const textLines: CompositionTextLine[] = [];
  const transcriptSegments: CompositionTranscriptSegment[] = [];

  if (process.env.USE_LOCAL_EVENTS === "true" && eventId.startsWith("local-")) {
    const sessions = await localGetEventTranscripts(eventId);
    for (const session of sessions) {
      for (const turn of session.turns) {
        if (turn.role !== "user") continue;
        const typed = (turn.content ?? "").trim();
        if (typed) {
          textLines.push({
            text: typed,
            source: "interview",
            sourceId: turn.id,
            participantId: session.participantId,
            participantLabel: session.participantName,
            conversationId: session.conversationId,
            createdAt: turn.createdAt,
          });
        }
        const audio = (turn.audioTranscript ?? "").trim();
        if (audio) {
          transcriptSegments.push({
            text: audio,
            mediaType: "audio",
            turnId: turn.id,
            participantId: session.participantId,
            participantLabel: session.participantName,
            conversationId: session.conversationId,
            createdAt: turn.createdAt,
          });
        }
        const video = (turn.videoTranscript ?? "").trim();
        if (video) {
          transcriptSegments.push({
            text: video,
            mediaType: "video",
            turnId: turn.id,
            participantId: session.participantId,
            participantLabel: session.participantName,
            conversationId: session.conversationId,
            createdAt: turn.createdAt,
          });
        }
      }
    }
    return { textLines, transcriptSegments };
  }

  if (!supabaseAdmin) {
    return { textLines, transcriptSegments };
  }

  const isLocalEvent = eventId.startsWith("local-");
  const { data: convs, error: convErr } = isLocalEvent
    ? await supabaseAdmin
        .from("agent_conversations")
        .select("id, participant_id")
        .eq("local_event_id", eventId)
    : await supabaseAdmin
        .from("agent_conversations")
        .select("id, participant_id")
        .eq("event_id", eventId);
  if (convErr) throw new Error(convErr.message);
  if (!convs?.length) return { textLines, transcriptSegments };

  const participantIds = convs.map((c) => c.participant_id);
  const { data: participants } = await supabaseAdmin
    .from("agent_participants")
    .select("id, name, display_name")
    .in("id", participantIds);
  const labelByParticipantId = new Map(
    (participants ?? []).map((p: { id: string; name: string | null; display_name: string | null }) => [
      p.id,
      (p.display_name ?? p.name ?? "Anonymous").trim() || "Anonymous",
    ])
  );

  for (const conv of convs) {
    const participantLabel = labelByParticipantId.get(conv.participant_id) ?? "Anonymous";
    const { data: turns, error: turnErr } = await supabaseAdmin
      .from("agent_conversation_turns")
      .select("id, turn_index, role, content, audio_transcript, video_transcript, created_at")
      .eq("conversation_id", conv.id)
      .order("turn_index", { ascending: true });
    if (turnErr) throw new Error(turnErr.message);

    for (const turn of turns ?? []) {
      if (turn.role !== "user") continue;
      const typed = (turn.content ?? "").trim();
      if (typed) {
        textLines.push({
          text: typed,
          source: "interview",
          sourceId: turn.id,
          participantId: conv.participant_id,
          participantLabel,
          conversationId: conv.id,
          createdAt: turn.created_at ?? undefined,
        });
      }
      const audio = (turn.audio_transcript ?? "").trim();
      if (audio) {
        transcriptSegments.push({
          text: audio,
          mediaType: "audio",
          turnId: turn.id,
          participantId: conv.participant_id,
          participantLabel,
          conversationId: conv.id,
          createdAt: turn.created_at ?? undefined,
        });
      }
      const video = (turn.video_transcript ?? "").trim();
      if (video) {
        transcriptSegments.push({
          text: video,
          mediaType: "video",
          turnId: turn.id,
          participantId: conv.participant_id,
          participantLabel,
          conversationId: conv.id,
          createdAt: turn.created_at ?? undefined,
        });
      }
    }
  }

  return { textLines, transcriptSegments };
}

type RoundRow = {
  id: string;
  session_id: string;
  prompt_text: string;
  prompt_block: unknown;
  closed_at: string | null;
};

function resolveWinningChoice(
  block: SignalPromptBlock,
  submissions: Array<{ id: string; device_id: string }>,
  voteCountBySubmissionId: Record<string, number>
): { choiceId: string; label: string; triggerId: string; voteCount: number } | null {
  let bestSubmissionId: string | null = null;
  let bestVotes = -1;
  for (const sub of submissions) {
    const count = voteCountBySubmissionId[sub.id] ?? 0;
    if (count > bestVotes) {
      bestVotes = count;
      bestSubmissionId = sub.id;
    }
  }
  if (!bestSubmissionId || bestVotes <= 0) return null;

  const winningSub = submissions.find((s) => s.id === bestSubmissionId);
  if (!winningSub) return null;

  const bySubmissionId = block.choices.find((c) => c.submissionId === bestSubmissionId);
  if (bySubmissionId) {
    return {
      choiceId: bySubmissionId.id,
      label: bySubmissionId.label,
      triggerId: bySubmissionId.triggerId,
      voteCount: bestVotes,
    };
  }

  if (isSignalChoiceDeviceId(winningSub.device_id)) {
    const choiceId = winningSub.device_id.slice(signalChoiceDeviceId("").length);
    const byDevice = block.choices.find((c) => c.id === choiceId);
    if (byDevice) {
      return {
        choiceId: byDevice.id,
        label: byDevice.label,
        triggerId: byDevice.triggerId,
        voteCount: bestVotes,
      };
    }
  }

  return null;
}

async function gatherLiveInputs(
  db: SupabaseClient,
  sessionIds: string[]
): Promise<{
  textLines: CompositionTextLine[];
  phraseCards: CompositionPhraseCard[];
  signalResolutions: SignalResolution[];
  liveSubmissionCount: number;
  signalRoundCount: number;
}> {
  const textLines: CompositionTextLine[] = [];
  const phraseCards: CompositionPhraseCard[] = [];
  const signalResolutions: SignalResolution[] = [];
  let liveSubmissionCount = 0;
  let signalRoundCount = 0;

  if (sessionIds.length === 0) {
    return { textLines, phraseCards, signalResolutions, liveSubmissionCount, signalRoundCount };
  }

  const { data: rounds, error: roundsErr } = await db
    .from("prompt_game_rounds")
    .select("id, session_id, prompt_text, prompt_block, closed_at")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: true });
  if (roundsErr) throw new Error(roundsErr.message);

  const roundRows = (rounds ?? []) as RoundRow[];
  const roundIds = roundRows.map((r) => r.id);
  if (roundIds.length === 0) {
    return { textLines, phraseCards, signalResolutions, liveSubmissionCount, signalRoundCount };
  }

  const { data: submissions, error: subErr } = await db
    .from("prompt_game_submissions")
    .select("id, session_id, round_id, device_id, raw_text, hidden, locked, created_at")
    .in("session_id", sessionIds)
    .in("round_id", roundIds)
    .order("created_at", { ascending: true });
  if (subErr) throw new Error(subErr.message);

  const { data: votes, error: votesErr } = await db
    .from("prompt_game_votes")
    .select("round_id, submission_id")
    .in("session_id", sessionIds)
    .in("round_id", roundIds);
  if (votesErr) throw new Error(votesErr.message);

  const submissionsByRound = new Map<string, typeof submissions>();
  for (const sub of submissions ?? []) {
    const list = submissionsByRound.get(sub.round_id) ?? [];
    list.push(sub);
    submissionsByRound.set(sub.round_id, list);
  }

  const voteCountByRoundSubmission = new Map<string, Record<string, number>>();
  for (const vote of votes ?? []) {
    const key = vote.round_id;
    const counts = voteCountByRoundSubmission.get(key) ?? {};
    counts[vote.submission_id] = (counts[vote.submission_id] ?? 0) + 1;
    voteCountByRoundSubmission.set(key, counts);
  }

  for (const round of roundRows) {
    const block = parsePromptBlock(round.prompt_block);
    const roundSubs = submissionsByRound.get(round.id) ?? [];
    const voteCounts = voteCountByRoundSubmission.get(round.id) ?? {};

    if (block?.kind === "signal") {
      signalRoundCount += 1;
      const winner = resolveWinningChoice(
        block,
        roundSubs.map((s) => ({ id: s.id, device_id: s.device_id })),
        voteCounts
      );
      if (winner) {
        signalResolutions.push({
          roundId: round.id,
          sessionId: round.session_id,
          layer: block.layerType,
          winningChoiceId: winner.choiceId,
          label: winner.label,
          triggerId: winner.triggerId,
          voteCount: winner.voteCount,
          promptText: round.prompt_text,
          closedAt: round.closed_at,
        });
      }
      continue;
    }

    const normalized = new Map<
      string,
      { id: string; raw_text: string; hidden: boolean; locked: boolean }
    >();
    for (const sub of roundSubs) {
      if (sub.hidden) continue;
      if (isSignalChoiceDeviceId(sub.device_id)) continue;
      const text = (sub.raw_text ?? "").trim();
      if (isSpam(text)) continue;

      liveSubmissionCount += 1;
      textLines.push({
        text,
        source: "live",
        sourceId: sub.id,
        roundId: sub.round_id,
        sessionId: sub.session_id,
        createdAt: sub.created_at ?? undefined,
      });

      const key = text.toLowerCase().slice(0, 200);
      if (!normalized.has(key)) {
        normalized.set(key, {
          id: sub.id,
          raw_text: text,
          hidden: sub.hidden === true,
          locked: sub.locked === true,
        });
      }
    }

    const cards = Array.from(normalized.values())
      .map((s) => ({
        id: s.id,
        rawText: s.raw_text,
        voteCount: voteCounts[s.id] ?? 0,
        roundId: round.id,
        sessionId: round.session_id,
        locked: s.locked,
      }))
      .sort((a, b) => b.voteCount - a.voteCount)
      .slice(0, 12);

    phraseCards.push(...cards);
  }

  return { textLines, phraseCards, signalResolutions, liveSubmissionCount, signalRoundCount };
}

/**
 * Gather raw creative material from Participation + Signal layers.
 * Uses stored transcripts only (no Whisper). At least one of eventId or sessionId is required.
 */
export async function gatherCompositionInputs(
  options: GatherCompositionInputsOptions,
  db: SupabaseClient | null = supabaseAdmin
): Promise<CompositionGatherResult> {
  if (!db) {
    throw new Error("Database not configured.");
  }

  const scope = await resolveScope(db, options);

  let textLines: CompositionTextLine[] = [];
  let transcriptSegments: CompositionTranscriptSegment[] = [];
  let interviewTurnCount = 0;

  if (scope.eventId) {
    const interview = await gatherInterviewInputs(scope.eventId);
    textLines = textLines.concat(interview.textLines);
    transcriptSegments = transcriptSegments.concat(interview.transcriptSegments);
    interviewTurnCount = interview.textLines.length + interview.transcriptSegments.length;
  }

  const live = await gatherLiveInputs(db, scope.sessionIds);
  textLines = textLines.concat(live.textLines);

  return {
    eventId: scope.eventId,
    sessionIds: scope.sessionIds,
    textLines,
    transcriptSegments,
    phraseCards: live.phraseCards,
    signalResolutions: live.signalResolutions,
    sourceCounts: {
      interviewTurns: interviewTurnCount,
      liveSubmissions: live.liveSubmissionCount,
      signalRounds: live.signalRoundCount,
      phraseCards: live.phraseCards.length,
    },
  };
}
