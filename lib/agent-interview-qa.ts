/**
 * Pair user interview answers with the preceding agent question turn,
 * and carry a submitted name across every answer in that conversation.
 */

import { displayPrompt } from "@/lib/participant-journey/interview-helpers";
import { DEFAULT_NAME_QUESTION_PROMPT } from "@/lib/agent-name-question";

export type InterviewTurnLike = {
  id?: string;
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
  /** User turn id — required to delete one contribution. */
  turnId: string | null;
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
      turnId: typeof turn.id === "string" && turn.id.trim() ? turn.id.trim() : null,
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

/**
 * Managed journeys store only user turns. When none of the answers already
 * carry a question, zip them to the journey prompts in order.
 */
export function fillMissingJourneyQuestions<T extends { questionText: string | null }>(
  answers: T[],
  prompts: string[]
): T[] {
  if (prompts.length === 0) return answers;
  if (answers.some((a) => a.questionText?.trim())) return answers;
  return answers.map((answer, index) => {
    const prompt = prompts[index]?.trim();
    if (!prompt) return answer;
    return { ...answer, questionText: prompt };
  });
}

export function normalizePersonKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isAnonymousPersonName(name: string | null | undefined): boolean {
  const n = normalizePersonKey(name);
  return !n || n === "anonymous" || n === "anon";
}

/** WorldJourney shows this when a name step has no custom prompt. */
const JOURNEY_NAME_PROMPT_FALLBACK = "What should we call you?";

const MEDIA_PLACEHOLDER = /^\((photo|recording)\)$/i;

export function isMediaPlaceholderContent(content: string | null | undefined): boolean {
  return MEDIA_PLACEHOLDER.test((content ?? "").trim());
}

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Prompts the composer can zip onto historical turns that stored no question. */
export type IdentityPrompt = {
  prompt: string;
  isName: boolean;
};

function namePromptKeys(prompt: string): string[] {
  const keys = new Set<string>();
  for (const value of [prompt, displayPrompt(prompt)]) {
    const key = normalizeKey(value);
    if (key) keys.add(key);
  }
  const fallbacks = [DEFAULT_NAME_QUESTION_PROMPT, JOURNEY_NAME_PROMPT_FALLBACK].map(normalizeKey);
  if (fallbacks.includes(normalizeKey(prompt))) {
    for (const fallback of fallbacks) keys.add(fallback);
  }
  return Array.from(keys);
}

function isUsableSubmittedName(content: string | null | undefined): boolean {
  const text = (content ?? "").trim();
  if (!text || isMediaPlaceholderContent(text)) return false;
  return !isAnonymousPersonName(text);
}

export type PresentedInterviewAnswer = PairedInterviewAnswer & {
  isNameAnswer: boolean;
};

/**
 * Label every answer in one conversation with the name that person submitted.
 * A stored participant name is used when the journey never asked for one.
 * Name-step answers are flagged so Composer can show them as the row name
 * instead of as another question column.
 */
export function presentInterviewConversation<T extends PairedInterviewAnswer>(args: {
  participantName: string | null | undefined;
  answers: T[];
  prompts: IdentityPrompt[];
}): { participantName: string; answers: Array<T & { isNameAnswer: boolean }> } {
  const filled = fillMissingJourneyQuestions(
    args.answers,
    args.prompts.map((item) => item.prompt)
  );
  const nameKeys = new Set(
    args.prompts.filter((item) => item.isName).flatMap((item) => namePromptKeys(item.prompt))
  );
  const stored = (args.participantName ?? "").trim();
  const storedIsReal = Boolean(stored) && !isAnonymousPersonName(stored);
  const nameAnswers = filled.filter(
    (answer) => nameKeys.size > 0 && nameKeys.has(normalizeKey(answer.questionText))
  );
  const submitted = nameAnswers.find((answer) => isUsableSubmittedName(answer.content));
  const participantName = storedIsReal
    ? stored
    : submitted
      ? submitted.content.trim()
      : "Anonymous";
  const identityKey = normalizeKey(participantName);
  const answers = filled.map((answer) => {
    const onNamePrompt = nameKeys.size > 0 && nameKeys.has(normalizeKey(answer.questionText));
    // A real saved name stays. Only hide the turn that actually submitted it,
    // so a later answer is not swallowed when the prompt zip is short.
    const matchesIdentity =
      !isAnonymousPersonName(participantName) &&
      normalizeKey(answer.content) === identityKey &&
      isUsableSubmittedName(answer.content);
    return {
      ...answer,
      isNameAnswer: onNamePrompt && matchesIdentity,
    };
  });
  return { participantName, answers };
}
