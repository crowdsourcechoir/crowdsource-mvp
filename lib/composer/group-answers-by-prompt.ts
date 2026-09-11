/**
 * Group Composer interview answers under their prompt for question-first layouts.
 */

export type ComposerAnswerRow = {
  id: string;
  participantName: string;
  questionText: string | null;
  content: string;
  createdAt: string;
  audioUrl?: string | null;
  videoUrl?: string | null;
  audioTranscript?: string | null;
  videoTranscript?: string | null;
  eventId?: string;
};

export type PromptAnswerGroup = {
  key: string;
  prompt: string;
  answers: ComposerAnswerRow[];
};

export function normalizePromptKey(questionText: string | null | undefined): string {
  const trimmed = (questionText ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return trimmed || "__untitled__";
}

export function promptLabel(questionText: string | null | undefined): string {
  const trimmed = (questionText ?? "").trim();
  return trimmed || "Untitled prompt";
}

/** Text-only rows: must have typed text; media-only answers are excluded. */
export function isTextAnswer(row: Pick<ComposerAnswerRow, "content">): boolean {
  return Boolean(row.content?.trim());
}

/** Pure media (no typed text) — belongs in Video/Sounds views, not Text. */
export function isMediaOnlyAnswer(
  row: Pick<ComposerAnswerRow, "content" | "audioUrl" | "videoUrl">
): boolean {
  return !row.content?.trim() && Boolean(row.audioUrl || row.videoUrl);
}

export function groupAnswersByPrompt(rows: ComposerAnswerRow[]): PromptAnswerGroup[] {
  const map = new Map<string, PromptAnswerGroup>();
  for (const row of rows) {
    const key = normalizePromptKey(row.questionText);
    let group = map.get(key);
    if (!group) {
      group = { key, prompt: promptLabel(row.questionText), answers: [] };
      map.set(key, group);
    }
    group.answers.push(row);
  }
  for (const group of Array.from(map.values())) {
    group.answers.sort((a: ComposerAnswerRow, b: ComposerAnswerRow) =>
      a.createdAt.localeCompare(b.createdAt)
    );
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.key === "__untitled__") return 1;
    if (b.key === "__untitled__") return -1;
    return a.prompt.localeCompare(b.prompt, undefined, { sensitivity: "base" });
  });
}
