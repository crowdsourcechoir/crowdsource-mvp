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
  type GardenEdition,
  type GardenKind,
  type GardenMutationRecord,
  type GardenOrder,
  type GardenStatus,
  type GamedayReadyItem,
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
  editions: GardenEdition[];
  orders: GardenOrder[];
  readyShelf: GamedayReadyItem[];
};

const EMPTY: LocalDb = {
  gardens: [],
  chapters: [],
  mutations: [],
  marks: [],
  editions: [],
  orders: [],
  readyShelf: [],
};

let cache: LocalDb | null = null;

function dataPath(): string {
  return path.join(process.cwd(), ".data", "local-gardens.json");
}

function ensureLoaded(): LocalDb {
  if (cache) return cache;
  const filePath = dataPath();
  if (!existsSync(filePath)) {
    cache = {
      gardens: [],
      chapters: [],
      mutations: [],
      marks: [],
      editions: [],
      orders: [],
      readyShelf: [],
    };
    return cache;
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as Partial<LocalDb>;
    cache = {
      gardens: Array.isArray(parsed.gardens) ? parsed.gardens : [],
      chapters: Array.isArray(parsed.chapters) ? parsed.chapters : [],
      mutations: Array.isArray(parsed.mutations) ? parsed.mutations : [],
      marks: Array.isArray(parsed.marks) ? parsed.marks : [],
      editions: Array.isArray(parsed.editions) ? parsed.editions : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      readyShelf: Array.isArray(parsed.readyShelf) ? parsed.readyShelf : [],
    };
  } catch {
    cache = {
      gardens: [],
      chapters: [],
      mutations: [],
      marks: [],
      editions: [],
      orders: [],
      readyShelf: [],
    };
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

export function localListMutations(
  gardenId: string,
  opts?: { beforeIso?: string | null; limit?: number }
): GardenMutationRecord[] {
  let list = ensureLoaded()
    .mutations.filter((m) => m.gardenId === gardenId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  if (opts?.beforeIso) {
    const cut = Date.parse(opts.beforeIso);
    if (Number.isFinite(cut)) {
      list = list.filter((m) => Date.parse(m.createdAt) <= cut);
    }
  }
  if (opts?.limit != null && opts.limit > 0 && !opts.beforeIso) {
    // recent-first for debugger when no historical cutoff
    return [...list].reverse().slice(0, opts.limit);
  }
  return list;
}

export function localUpdateChapter(
  chapterId: string,
  updates: Partial<Pick<GardenChapter, "status" | "label" | "chapterWeight" | "opensAt" | "closesAt">>
): GardenChapter | null {
  const db = ensureLoaded();
  const idx = db.chapters.findIndex((c) => c.id === chapterId);
  if (idx < 0) return null;
  const prev = db.chapters[idx];
  const next: GardenChapter = {
    ...prev,
    status: updates.status ?? prev.status,
    label: updates.label?.trim() || prev.label,
    chapterWeight: updates.chapterWeight ?? prev.chapterWeight,
    opensAt: updates.opensAt !== undefined ? updates.opensAt : prev.opensAt,
    closesAt: updates.closesAt !== undefined ? updates.closesAt : prev.closesAt,
  };
  db.chapters[idx] = next;
  persist();
  return next;
}

export function localGetChapterById(chapterId: string): GardenChapter | null {
  return ensureLoaded().chapters.find((c) => c.id === chapterId) ?? null;
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
  sourceType: import("./types").GardenSourceType;
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

export function localListEditions(gardenId: string): GardenEdition[] {
  return ensureLoaded()
    .editions.filter((e) => e.gardenId === gardenId)
    .sort((a, b) => (a.pinnedAt < b.pinnedAt ? 1 : -1));
}

export function localGetEdition(
  gardenId: string,
  editionIdOrSlug: string
): GardenEdition | null {
  return (
    ensureLoaded().editions.find(
      (e) =>
        e.gardenId === gardenId &&
        (e.id === editionIdOrSlug || e.slug === editionIdOrSlug)
    ) ?? null
  );
}

export function localCreateEdition(input: {
  gardenId: string;
  slug: string;
  label: string;
  pinnedSnapshot: import("./types").PinnedMerchSnapshot;
  renderSeed: string;
}): GardenEdition {
  const db = ensureLoaded();
  if (!db.gardens.some((g) => g.id === input.gardenId)) {
    throw new Error("Garden not found.");
  }
  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  if (!slug) throw new Error("slug is required");
  if (db.editions.some((e) => e.gardenId === input.gardenId && e.slug === slug)) {
    throw new Error("An edition with that slug already exists for this garden.");
  }
  const edition: GardenEdition = {
    id: nextId("edition"),
    gardenId: input.gardenId,
    slug,
    label: input.label.trim() || slug,
    pinnedSnapshot: input.pinnedSnapshot,
    renderSeed: input.renderSeed,
    pinnedAt: new Date().toISOString(),
  };
  db.editions.push(edition);
  persist();
  return edition;
}

export function localListOrders(gardenId: string): GardenOrder[] {
  return ensureLoaded()
    .orders.filter((o) => o.gardenId === gardenId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function localGetOrder(orderId: string): GardenOrder | null {
  return ensureLoaded().orders.find((o) => o.id === orderId) ?? null;
}

export function localCreateOrder(
  order: Omit<GardenOrder, "id" | "createdAt"> & { id?: string; createdAt?: string }
): GardenOrder {
  const db = ensureLoaded();
  if (!db.gardens.some((g) => g.id === order.gardenId)) {
    throw new Error("Garden not found.");
  }
  const row: GardenOrder = {
    ...order,
    id: order.id ?? nextId("order"),
    createdAt: order.createdAt ?? new Date().toISOString(),
  };
  db.orders.push(row);
  persist();
  return row;
}

export function localListReadyShelf(gardenId: string): GamedayReadyItem[] {
  return ensureLoaded()
    .readyShelf.filter((i) => i.gardenId === gardenId)
    .sort((a, b) => a.sortIndex - b.sortIndex || (a.createdAt < b.createdAt ? 1 : -1));
}

export function localGetReadyItem(id: string): GamedayReadyItem | null {
  return ensureLoaded().readyShelf.find((i) => i.id === id) ?? null;
}

export function localCreateReadyItem(
  item: Omit<GamedayReadyItem, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
  }
): GamedayReadyItem {
  const db = ensureLoaded();
  if (!db.gardens.some((g) => g.id === item.gardenId)) {
    throw new Error("Garden not found.");
  }
  const now = new Date().toISOString();
  const row: GamedayReadyItem = {
    ...item,
    id: item.id ?? nextId("shelf"),
    createdAt: item.createdAt ?? now,
    updatedAt: item.updatedAt ?? now,
  };
  db.readyShelf.push(row);
  persist();
  return row;
}

export function localUpdateReadyItem(
  id: string,
  updates: Partial<
    Pick<
      GamedayReadyItem,
      "title" | "momentType" | "zoneKey" | "sponsorKey" | "note" | "payload" | "status" | "sortIndex"
    >
  >
): GamedayReadyItem | null {
  const db = ensureLoaded();
  const idx = db.readyShelf.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  const prev = db.readyShelf[idx];
  const next: GamedayReadyItem = {
    ...prev,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  db.readyShelf[idx] = next;
  persist();
  return next;
}
