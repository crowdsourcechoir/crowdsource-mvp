import {
  isAnonymousPersonName,
  isMediaPlaceholderContent,
  normalizePersonKey,
} from "@/lib/agent-interview-qa";
import { isPhotoContribution } from "@/lib/composer/media-drag";

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
  /** Name-step text. Shown as the person's name, not as a question cell. */
  isNameAnswer?: boolean;
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

export function isTypedTextAnswer(content: string | null | undefined): boolean {
  const text = (content ?? "").trim();
  return Boolean(text) && !isMediaPlaceholderContent(text);
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
  const typed = rows.filter((row) => isTypedTextAnswer(row.content) && !row.isNameAnswer);
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

export type JourneySubmission = {
  key: string;
  name: string;
  firstAt: string;
  answers: ComposerAnswerRow[];
  media: ComposerAnswerRow[];
};

/**
 * One block per journey. The submitted name heads the block; later answers and
 * photos from that same conversation stay with it. A second visit is a second block.
 */
export function groupJourneySubmissions(
  texts: ComposerAnswerRow[],
  media: ComposerAnswerRow[]
): JourneySubmission[] {
  const map = new Map<string, JourneySubmission>();

  function slot(row: ComposerAnswerRow): JourneySubmission {
    const key = row.conversationId || row.id;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        name: isAnonymousPersonName(row.participantName) ? "Anonymous" : row.participantName.trim(),
        firstAt: row.createdAt,
        answers: [],
        media: [],
      };
      map.set(key, group);
    }
    if (isAnonymousPersonName(group.name) && !isAnonymousPersonName(row.participantName)) {
      group.name = row.participantName.trim();
    }
    if (row.createdAt < group.firstAt) group.firstAt = row.createdAt;
    return group;
  }

  for (const row of texts) {
    const group = slot(row);
    if (row.isNameAnswer || !isTypedTextAnswer(row.content)) continue;
    group.answers.push(row);
  }
  for (const row of media) {
    if (!row.videoUrl?.trim()) continue;
    slot(row).media.push(row);
  }

  const groups = Array.from(map.values());
  for (const group of groups) {
    group.answers.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    group.media.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  groups.sort((a, b) => {
    const aAnon = isAnonymousPersonName(a.name);
    const bAnon = isAnonymousPersonName(b.name);
    if (aAnon !== bAnon) return aAnon ? 1 : -1;
    const byName = a.name.localeCompare(b.name);
    if (byName !== 0) return byName;
    return a.firstAt.localeCompare(b.firstAt);
  });
  return groups;
}

export function isPhotoRow(row: Pick<ComposerAnswerRow, "content" | "videoUrl">): boolean {
  return isPhotoContribution(row.content, row.videoUrl);
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
