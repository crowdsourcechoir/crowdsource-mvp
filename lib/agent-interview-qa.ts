/**
 * Pair user interview answers with the preceding agent question turn.
 */

export type InterviewTurnLike = {
  role: string;
  content?: string | null;
  createdAt?: string;
  created_at?: string;
  audioUrl?: string | null;
  audio_url?: string | null;
  videoUrl?: string | null;
  video_url?: string | null;
  audioTranscript?: string | null;
  audio_transcript?: string | null;
  videoTranscript?: string | null;
  video_transcript?: string | null;
  turnIndex?: number;
  turn_index?: number;
};

export type PairedInterviewAnswer = {
  createdAt: string;
  content: string;
  questionText: string | null;
  audioUrl: string | null;
  videoUrl: string | null;
  audioTranscript: string | null;
  videoTranscript: string | null;
};

function createdAtOf(t: InterviewTurnLike): string {
  return (t.createdAt || t.created_at || "").toString();
}

function contentOf(t: InterviewTurnLike): string {
  return typeof t.content === "string" ? t.content.trim() : "";
}

/**
 * Walk turns in order. Each user turn inherits the most recent prior agent
 * turn’s content as `questionText` (null if none).
 */
export function pairInterviewAnswers(turns: InterviewTurnLike[]): PairedInterviewAnswer[] {
  const sorted = [...turns].sort((a, b) => {
    const ai = a.turnIndex ?? a.turn_index;
    const bi = b.turnIndex ?? b.turn_index;
    if (typeof ai === "number" && typeof bi === "number" && ai !== bi) return ai - bi;
    return createdAtOf(a).localeCompare(createdAtOf(b));
  });

  let lastQuestion: string | null = null;
  const answers: PairedInterviewAnswer[] = [];

  for (const turn of sorted) {
    const role = (turn.role || "").toLowerCase();
    if (role === "agent") {
      const q = contentOf(turn);
      if (q) lastQuestion = q;
      continue;
    }
    if (role !== "user") continue;

    answers.push({
      createdAt: createdAtOf(turn) || new Date().toISOString(),
      content: contentOf(turn),
      questionText: lastQuestion,
      audioUrl: turn.audioUrl ?? turn.audio_url ?? null,
      videoUrl: turn.videoUrl ?? turn.video_url ?? null,
      audioTranscript: turn.audioTranscript ?? turn.audio_transcript ?? null,
      videoTranscript: turn.videoTranscript ?? turn.video_transcript ?? null,
    });
  }

  return answers;
}

export function normalizePersonKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isAnonymousPersonName(name: string | null | undefined): boolean {
  const n = normalizePersonKey(name);
  return !n || n === "anonymous" || n === "anon";
}
