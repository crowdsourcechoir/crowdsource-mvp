/**
 * Local JSON store for gardens when USE_LOCAL_EVENTS=true.
 * Persists to .data/local-gardens.json.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  defaultBrandKit,
  defaultMutationPolicy,
  emptyWorldState,
  type BrandKit,
  type ContributionKind,
  type Garden,
  type GardenChapter,
  type GardenKind,
  type GardenMutationRecord,
  type GardenStatus,
  type MutationPolicy,
  type ParticipantMark,
  type WorldEffect,
  type WorldState,
} from "./types";

type LocalDb = {
  gardens: Garden[];
  chapters: GardenChapter[];
  mutations: GardenMutationRecord[];
  marks: ParticipantMark[];
};

const EMPTY: LocalDb = { gardens: [], chapters: [], mutations: [], marks: [] };

let cache: LocalDb | null = null;

function dataPath(): string {
  return path.join(process.cwd(), ".data", "local-gardens.json");
}

function ensureLoaded(): LocalDb {
  if (cache) return cache;
  const filePath = dataPath();
  if (!existsSync(filePath)) {
    cache = { ...EMPTY, gardens: [], chapters: [], mutations: [], marks: [] };
    return cache;
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as Partial<LocalDb>;
    cache = {
      gardens: Array.isArray(parsed.gardens) ? parsed.gardens : [],
      chapters: Array.isArray(parsed.chapters) ? parsed.chapters : [],
      mutations: Array.isArray(parsed.mutations) ? parsed.mutations : [],
      marks: Array.isArray(parsed.marks) ? parsed.marks : [],
    };
  } catch {
    cache = { gardens: [], chapters: [], mutations: [], marks: [] };
  }
  return cache;
}

function persist(): void {
  const db = ensureLoaded();
  try {
    const dir = path.dirname(dataPath());
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(dataPath(), JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.warn("Local gardens: failed to persist:", err);
  }
}

function nextId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function localListGardens(): Garden[] {
  return [...ensureLoaded().gardens].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
}

export function localGetGardenByIdOrSlug(idOrSlug: string): Garden | null {
  const db = ensureLoaded();
  return (
    db.gardens.find((g) => g.id === idOrSlug || g.slug === idOrSlug) ?? null
  );
}

export function localCreateGarden(input: {
  slug: string;
  title: string;
  kind?: GardenKind;
  status?: GardenStatus;
  brandKit?: Partial<BrandKit>;
  mutationPolicy?: Partial<MutationPolicy>;
}): Garden {
  const db = ensureLoaded();
  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  if (!slug) throw new Error("slug is required");
  if (db.gardens.some((g) => g.slug === slug)) {
    throw new Error("A garden with that slug already exists.");
  }
  const now = new Date().toISOString();
  const id = nextId("garden");
  const brandKit = defaultBrandKit({ ...input.brandKit, title: input.brandKit?.title || input.title });
  const garden: Garden = {
    id,
    slug,
    title: input.title.trim() || slug,
    kind: input.kind ?? "series",
    status: input.status ?? "draft",
    brandKit,
    worldState: emptyWorldState(`garden_${id.slice(0, 12)}`, now),
    worldVersion: 0,
    mutationPolicy: defaultMutationPolicy(input.mutationPolicy),
    commerce: null,
    createdAt: now,
    updatedAt: now,
  };
  db.gardens.push(garden);
  persist();
  return garden;
}

export function localUpdateGarden(
  id: string,
  updates: Partial<Pick<Garden, "title" | "kind" | "status" | "brandKit" | "mutationPolicy" | "commerce">>
): Garden | null {
  const db = ensureLoaded();
  const idx = db.gardens.findIndex((g) => g.id === id);
  if (idx < 0) return null;
  const prev = db.gardens[idx];
  const next: Garden = {
    ...prev,
    title: updates.title?.trim() || prev.title,
    kind: updates.kind ?? prev.kind,
    status: updates.status ?? prev.status,
    brandKit: updates.brandKit
      ? defaultBrandKit({ ...prev.brandKit, ...updates.brandKit })
      : prev.brandKit,
    mutationPolicy: updates.mutationPolicy
      ? defaultMutationPolicy({ ...prev.mutationPolicy, ...updates.mutationPolicy })
      : prev.mutationPolicy,
    commerce: updates.commerce !== undefined ? updates.commerce : prev.commerce,
    updatedAt: new Date().toISOString(),
  };
  db.gardens[idx] = next;
  persist();
  return next;
}

export function localListChapters(gardenId: string): GardenChapter[] {
  return ensureLoaded()
    .chapters.filter((c) => c.gardenId === gardenId)
    .sort((a, b) => a.index - b.index);
}

export function localGetChapterByEventId(eventId: string): GardenChapter | null {
  return ensureLoaded().chapters.find((c) => c.eventId === eventId) ?? null;
}

export function localAddChapter(input: {
  gardenId: string;
  eventId: string;
  index: number;
  label?: string;
  chapterWeight?: number;
  status?: GardenChapter["status"];
  opensAt?: string | null;
  closesAt?: string | null;
}): GardenChapter {
  const db = ensureLoaded();
  if (!db.gardens.some((g) => g.id === input.gardenId)) {
    throw new Error("Garden not found.");
  }
  if (db.chapters.some((c) => c.eventId === input.eventId)) {
    throw new Error("That event is already attached to a garden chapter.");
  }
  if (db.chapters.some((c) => c.gardenId === input.gardenId && c.index === input.index)) {
    throw new Error("That chapter index is already used in this garden.");
  }
  const chapter: GardenChapter = {
    id: nextId("chapter"),
    gardenId: input.gardenId,
    eventId: input.eventId,
    index: input.index,
    label: input.label?.trim() || `Show ${input.index}`,
    opensAt: input.opensAt ?? null,
    closesAt: input.closesAt ?? null,
    chapterWeight: input.chapterWeight ?? 1,
    status: input.status ?? "open",
  };
  db.chapters.push(chapter);
  persist();
  return chapter;
}

export function localListMarks(gardenId: string, deviceId: string): ParticipantMark[] {
  return ensureLoaded()
    .marks.filter((m) => m.gardenId === gardenId && m.deviceId === deviceId)
    .sort((a, b) => a.index - b.index);
}

export function localRecentDeviceMutationAts(
  gardenId: string,
  deviceId: string,
  limit = 20
): string[] {
  return ensureLoaded()
    .mutations.filter((m) => m.gardenId === gardenId && m.deviceId === deviceId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    .slice(-limit)
    .map((m) => m.createdAt);
}

export function localPersistMutation(args: {
  gardenId: string;
  chapterId: string | null;
  deviceId: string | null;
  kind: ContributionKind;
  sourceType: "clip" | "turn";
  sourceId: string;
  delta: Record<string, unknown>;
  effects: WorldEffect[];
  nextState: WorldState;
  markIndex: number;
}): { garden: Garden; mutation: GardenMutationRecord; mark: ParticipantMark | null } {
  const db = ensureLoaded();
  const gIdx = db.gardens.findIndex((g) => g.id === args.gardenId);
  if (gIdx < 0) throw new Error("Garden not found.");
  const now = new Date().toISOString();
  const worldVersion = args.nextState.version;
  const garden: Garden = {
    ...db.gardens[gIdx],
    worldState: args.nextState,
    worldVersion,
    updatedAt: now,
  };
  db.gardens[gIdx] = garden;

  const mutation: GardenMutationRecord = {
    id: nextId("mut"),
    gardenId: args.gardenId,
    chapterId: args.chapterId,
    deviceId: args.deviceId,
    kind: args.kind,
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    delta: args.delta,
    effects: args.effects,
    worldVersion,
    createdAt: now,
  };
  db.mutations.push(mutation);

  let mark: ParticipantMark | null = null;
  if (args.deviceId) {
    mark = {
      id: nextId("mark"),
      gardenId: args.gardenId,
      deviceId: args.deviceId,
      kind: args.kind,
      index: args.markIndex,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      createdAt: now,
    };
    db.marks.push(mark);
  }

  persist();
  return { garden, mutation, mark };
}
