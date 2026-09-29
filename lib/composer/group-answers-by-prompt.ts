import {
  isAnonymousPersonName,
  normalizePersonKey,
} from "@/lib/agent-interview-qa";

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
  conversationId?: string;
  turnId?: string | null;
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

const MEDIA_PLACEHOLDER = /^\((photo|recording)\)$/i;

export function isTypedTextAnswer(content: string | null | undefined): boolean {
  const text = (content ?? "").trim();
  return Boolean(text) && !MEDIA_PLACEHOLDER.test(text);
}

export type PersonTableColumn = {
  key: string;
  prompt: string;
};

export type PersonTableRow = {
  key: string;
  name: string;
  /** Prompt key → answers in that cell. Missing key means the person skipped it. */
  cells: Record<string, ComposerAnswerRow[]>;
};

/**
 * One row per person, one column per question. Column order follows the
 * first time each question was answered.
 */
export function answersToPersonTable(rows: ComposerAnswerRow[]): {
  columns: PersonTableColumn[];
  rows: PersonTableRow[];
} {
  const typed = rows.filter((row) => isTypedTextAnswer(row.content));
  const grouped = groupAnswersByPrompt(typed);
  const columns: PersonTableColumn[] = grouped.map((group) => ({
    key: group.key,
    prompt: group.prompt,
  }));

  const byPerson = new Map<string, PersonTableRow & { firstAt: string }>();
  for (const row of typed) {
    const anonymous = isAnonymousPersonName(row.participantName);
    const personKey = anonymous
      ? `anon:${row.conversationId || row.id}`
      : `name:${normalizePersonKey(row.participantName)}`;
    let person = byPerson.get(personKey);
    if (!person) {
      person = {
        key: personKey,
        name: anonymous ? "Anonymous" : row.participantName.trim() || "Anonymous",
        cells: {},
        firstAt: row.createdAt,
      };
      byPerson.set(personKey, person);
    }
    if (row.createdAt < person.firstAt) person.firstAt = row.createdAt;
    const promptKey = normalizePromptKey(row.questionText);
    const list = person.cells[promptKey] ?? [];
    list.push(row);
    person.cells[promptKey] = list;
  }

  const people = Array.from(byPerson.values()).sort((a, b) =>
    a.firstAt.localeCompare(b.firstAt)
  );
  return {
    columns,
    rows: people.map(({ firstAt: _firstAt, ...person }) => person),
  };
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
    const aTime = a.answers[0]?.createdAt ?? "";
    const bTime = b.answers[0]?.createdAt ?? "";
    return aTime.localeCompare(bTime);
  });
}
