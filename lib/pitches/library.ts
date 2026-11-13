import {
  QUEUE_CATEGORY_CHIPS,
  QUEUE_CATEGORY_KEYS,
  type QueueCategoryFilter,
  type QueueCategoryKey,
} from "@/lib/sales/queue/category";
import { QUEUE_WORKSTREAM_OPTIONS, type QueueWorkstreamFilter } from "@/lib/sales/queue/workstream";
import { WORKSTREAMS, WORKSTREAM_KEYS, type WorkstreamKey } from "@/lib/sales/strategy/playbook";

export type PitchListItem = {
  name: string;
  title: string;
  prompt: string;
  href: string;
  category: string | null;
  workstream: string | null;
  organizationName: string | null;
};

export const PITCH_WORK_FILTERS = QUEUE_WORKSTREAM_OPTIONS;
export const PITCH_CATEGORY_FILTERS = QUEUE_CATEGORY_CHIPS;
export const PITCH_WORK_OPTIONS = QUEUE_WORKSTREAM_OPTIONS.filter(
  (option): option is { key: WorkstreamKey; label: string } => option.key !== "all"
);
export const PITCH_CATEGORY_OPTIONS = QUEUE_CATEGORY_CHIPS.filter(
  (option): option is { key: QueueCategoryKey; label: string } => option.key !== "all"
);

const CATEGORY_ALIASES: Record<string, QueueCategoryKey> = {
  conference: "conferences",
  fundraiser: "fundraisers",
  art: "arts",
  "booking agent": "booking_agents",
};

const WORK_ALIASES: Record<string, WorkstreamKey> = {
  partnerships: "partnership",
  sponsors: "sponsor",
};

function normalized(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : "";
}

/** A sales category key, or null when the pitch is left uncategorized. */
export function pitchCategoryFrom(value: unknown): QueueCategoryKey | null {
  const text = normalized(value);
  if (!text) return null;
  if ((QUEUE_CATEGORY_KEYS as readonly string[]).includes(text)) return text as QueueCategoryKey;
  const labeled = PITCH_CATEGORY_OPTIONS.find((option) => option.label.toLowerCase() === text);
  if (labeled) return labeled.key;
  return CATEGORY_ALIASES[text] ?? null;
}

/** A sales workstream key, or null when the pitch has no work filing. */
export function pitchWorkFrom(value: unknown): WorkstreamKey | null {
  const text = normalized(value);
  if (!text) return null;
  if ((WORKSTREAM_KEYS as readonly string[]).includes(text)) return text as WorkstreamKey;
  for (const key of WORKSTREAM_KEYS) {
    const work = WORKSTREAMS[key];
    if (text === work.shortLabel.toLowerCase() || text === work.label.toLowerCase()) return key;
    if (text === `${work.shortLabel} ${work.effortPct}%`.toLowerCase()) return key;
  }
  return WORK_ALIASES[text] ?? null;
}

export function pitchWorkLabel(workstream: string | null): string {
  const key = pitchWorkFrom(workstream);
  return key ? (PITCH_WORK_OPTIONS.find((option) => option.key === key)?.label ?? key) : "";
}

export function pitchCategoryLabel(category: string | null): string {
  const key = pitchCategoryFrom(category);
  return key ? (PITCH_CATEGORY_OPTIONS.find((option) => option.key === key)?.label ?? key) : "";
}

export function pitchMatchesWork(workstream: string | null, filter: QueueWorkstreamFilter): boolean {
  if (filter === "all") return true;
  return pitchWorkFrom(workstream) === filter;
}

export function pitchMatchesCategory(category: string | null, filter: QueueCategoryFilter): boolean {
  if (filter === "all") return true;
  return pitchCategoryFrom(category) === filter;
}

/** Case-insensitive match across the name, headline, prompt, address, work, category, and organization. */
export function pitchMatchesQuery(pitch: PitchListItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    pitch.name,
    pitch.title,
    pitch.prompt,
    pitch.href,
    pitchWorkLabel(pitch.workstream),
    pitchCategoryLabel(pitch.category),
    pitch.organizationName ?? "",
  ]
    .join("\n")
    .toLowerCase()
    .includes(needle);
}

export function countPitchWork(workstreams: Array<string | null>): Record<QueueWorkstreamFilter, number> {
  const counts: Record<QueueWorkstreamFilter, number> = {
    all: workstreams.length,
    premium: 0,
    partnership: 0,
    sponsor: 0,
    owned: 0,
  };
  for (const workstream of workstreams) {
    const key = pitchWorkFrom(workstream);
    if (key) counts[key] += 1;
  }
  return counts;
}

export function countPitchCategories(categories: Array<string | null>): Record<QueueCategoryFilter, number> {
  const counts: Record<QueueCategoryFilter, number> = {
    all: categories.length,
    sports: 0,
    conferences: 0,
    fundraisers: 0,
    arts: 0,
    entertainment: 0,
    tech: 0,
    booking_agents: 0,
    other: 0,
  };
  for (const category of categories) {
    const key = pitchCategoryFrom(category);
    if (key) counts[key] += 1;
  }
  return counts;
}
