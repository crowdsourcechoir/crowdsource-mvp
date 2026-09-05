import { supabaseAdmin } from "@/lib/supabase-server";
import { isMissingTableError } from "@/lib/supabase-table-errors";
import { localEventsGetById } from "@/lib/local-events-store";
import { applyChapterFinale, applyMutation, replayMutationsToState } from "./apply-mutation";
import { buildGardenSnapshot, resolveContributionWindow } from "./snapshot";
import {
  localAddChapter,
  localCreateEdition,
  localCreateGarden,
  localCreateOrder,
  localCreateReadyItem,
  localGetChapterByEventId,
  localGetChapterById,
  localGetEdition,
  localGetGardenByIdOrSlug,
  localGetOrder,
  localGetReadyItem,
  localListChapters,
  localListEditions,
  localListGardens,
  localListMarks,
  localListMutations,
  localListOrders,
  localListReadyShelf,
  localPersistMutation,
  localRecentDeviceMutationAts,
  localDeleteChaptersByEventId,
  localDeleteGarden,
  localUpdateChapter,
  localUpdateGarden,
  localUpdateReadyItem,
} from "./local-garden-store";
import { buildMerchRenderInput, buildPinnedMerchSnapshot, editionToMerchInput } from "./merch-render";
import {
  defaultBrandKit,
  mergeBrandKit,
  defaultMutationPolicy,
  emptyWorldState,
  isContributionKind,
  isMerchFormat,
  type BrandKit,
  type ContributionKind,
  type Garden,
  type GardenChapter,
  type GardenEdition,
  type GardenKind,
  type GardenMutationRecord,
  type GardenOrder,
  type GardenOrderKind,
  type GardenSnapshot,
  type GardenSourceType,
  type GardenStatus,
  type GamedayMomentType,
  type GamedayReadyItem,
  type MerchFormat,
  type MerchRenderInput,
  type MutationPolicy,
  type ParticipantMark,
  type PinnedMerchSnapshot,
  type WorldEffect,
  type WorldState,
} from "./types";

const USE_LOCAL = () => process.env.USE_LOCAL_EVENTS === "true";

function rowToGarden(row: Record<string, unknown>): Garden {
  const id = String(row.id);
  const brandRaw = (row.brand_kit ?? {}) as Partial<BrandKit>;
  const policyRaw = (row.mutation_policy ?? {}) as Partial<MutationPolicy>;
  const stateRaw = row.world_state as WorldState | null;
  return {
    id,
    slug: String(row.slug),
    title: String(row.title),
    kind: (row.kind as GardenKind) || "series",
    status: (row.status as GardenStatus) || "draft",
    brandKit: defaultBrandKit(brandRaw),
    worldState:
      stateRaw && typeof stateRaw === "object"
        ? stateRaw
        : emptyWorldState(`garden_${id.slice(0, 8)}`),
    worldVersion: Number(row.world_version) || 0,
    mutationPolicy: defaultMutationPolicy(policyRaw),
    commerce: row.commerce ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function rowToChapter(row: Record<string, unknown>): GardenChapter {
  return {
    id: String(row.id),
    gardenId: String(row.garden_id),
    eventId: String(row.event_id),
    index: Number(row.idx),
    label: String(row.label ?? ""),
    opensAt: row.opens_at != null ? String(row.opens_at) : null,
    closesAt: row.closes_at != null ? String(row.closes_at) : null,
    chapterWeight: Number(row.chapter_weight) || 1,
    status: (row.status as GardenChapter["status"]) || "upcoming",
  };
}

function rowToMark(row: Record<string, unknown>): ParticipantMark {
  const sourceType = normalizeSourceType(row.source_type);
  return {
    id: String(row.id),
    gardenId: String(row.garden_id),
    deviceId: String(row.device_id),
    kind: isContributionKind(row.kind) ? row.kind : "other",
    index: Number(row.idx) || 0,
    sourceType,
    sourceId: String(row.source_id),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function normalizeSourceType(value: unknown): GardenSourceType {
  if (value === "clip" || value === "turn" || value === "pulse" || value === "finale") {
    return value;
  }
  return "turn";
}

function rowToMutation(row: Record<string, unknown>): GardenMutationRecord {
  return {
    id: String(row.id),
    gardenId: String(row.garden_id),
    chapterId: row.chapter_id != null ? String(row.chapter_id) : null,
    deviceId: row.device_id != null ? String(row.device_id) : null,
    kind: isContributionKind(row.kind) ? row.kind : "other",
    sourceType: normalizeSourceType(row.source_type),
    sourceId: String(row.source_id),
    delta: (row.delta as Record<string, unknown>) ?? {},
    effects: Array.isArray(row.effects) ? (row.effects as WorldEffect[]) : [],
    worldVersion: Number(row.world_version) || 0,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function listGardens(): Promise<Garden[]> {
  if (USE_LOCAL()) return localListGardens();
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("gardens")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[gardens] list failed:", error.message);
    return [];
  }
  return (data ?? []).map((r) => rowToGarden(r as Record<string, unknown>));
}

export async function getGardenByIdOrSlug(idOrSlug: string): Promise<Garden | null> {
  if (USE_LOCAL()) return localGetGardenByIdOrSlug(idOrSlug);
  if (!supabaseAdmin) return null;
  const byId = await supabaseAdmin.from("gardens").select("*").eq("id", idOrSlug).maybeSingle();
  if (byId.data) return rowToGarden(byId.data as Record<string, unknown>);
  const bySlug = await supabaseAdmin.from("gardens").select("*").eq("slug", idOrSlug).maybeSingle();
  if (bySlug.data) return rowToGarden(bySlug.data as Record<string, unknown>);
  if (byId.error && !byId.error.message.includes("results contain 0 rows")) {
    console.warn("[gardens] get failed:", byId.error.message);
  }
  return null;
}

export async function createGarden(input: {
  slug: string;
  title: string;
  kind?: GardenKind;
  status?: GardenStatus;
  brandKit?: Partial<BrandKit>;
  mutationPolicy?: Partial<MutationPolicy>;
}): Promise<Garden> {
  if (USE_LOCAL()) return localCreateGarden(input);
  if (!supabaseAdmin) throw new Error("Database not configured.");
  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const brandKit = defaultBrandKit({ ...input.brandKit, title: input.brandKit?.title || input.title });
  const mutationPolicy = defaultMutationPolicy(input.mutationPolicy);
  const idPlaceholder = crypto.randomUUID();
  const worldState = emptyWorldState(`garden_${idPlaceholder.slice(0, 8)}`);
  const { data, error } = await supabaseAdmin
    .from("gardens")
    .insert({
      slug,
      title: input.title.trim() || slug,
      kind: input.kind ?? "series",
      status: input.status ?? "draft",
      brand_kit: brandKit,
      world_state: worldState,
      world_version: 0,
      mutation_policy: mutationPolicy,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create garden.");
  return rowToGarden(data as Record<string, unknown>);
}

export async function updateGarden(
  id: string,
  updates: Partial<{
    title: string;
    kind: GardenKind;
    status: GardenStatus;
    brandKit: Partial<BrandKit>;
    mutationPolicy: Partial<MutationPolicy>;
    commerce: unknown | null;
  }>
): Promise<Garden | null> {
  if (USE_LOCAL()) {
    return localUpdateGarden(id, {
      title: updates.title,
      kind: updates.kind,
      status: updates.status,
      brandKit: updates.brandKit as BrandKit | undefined,
      mutationPolicy: updates.mutationPolicy as MutationPolicy | undefined,
      commerce: updates.commerce,
    });
  }
  if (!supabaseAdmin) throw new Error("Database not configured.");
  const existing = await getGardenByIdOrSlug(id);
  if (!existing) return null;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title != null) patch.title = updates.title.trim();
  if (updates.kind != null) patch.kind = updates.kind;
  if (updates.status != null) patch.status = updates.status;
  if (updates.brandKit) patch.brand_kit = mergeBrandKit(existing.brandKit, updates.brandKit);
  if (updates.mutationPolicy) {
    patch.mutation_policy = defaultMutationPolicy({
      ...existing.mutationPolicy,
      ...updates.mutationPolicy,
    });
  }
  if (updates.commerce !== undefined) patch.commerce = updates.commerce;
  const { data, error } = await supabaseAdmin
    .from("gardens")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to update garden.");
  return rowToGarden(data as Record<string, unknown>);
}

async function deleteGardenChildRows(table: string, gardenId: string): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from(table).delete().eq("garden_id", gardenId);
  if (error && !isMissingTableError(error)) {
    throw new Error(error.message);
  }
}

/** Remove chapter links so a bloom can be deleted without leaving dangling garden shows. */
export async function unlinkChaptersForEvent(eventId: string): Promise<number> {
  if (USE_LOCAL()) return localDeleteChaptersByEventId(eventId);
  if (!supabaseAdmin) return 0;
  const { data, error } = await supabaseAdmin
    .from("garden_chapters")
    .delete()
    .eq("event_id", eventId)
    .select("id");
  if (error) {
    if (isMissingTableError(error)) return 0;
    throw new Error(error.message);
  }
  return data?.length ?? 0;
}

export async function deleteGarden(idOrSlug: string): Promise<Garden | null> {
  if (USE_LOCAL()) return localDeleteGarden(idOrSlug);
  if (!supabaseAdmin) throw new Error("Database not configured.");
  const existing = await getGardenByIdOrSlug(idOrSlug);
  if (!existing) return null;
  // Child tables first in case ON DELETE CASCADE was never applied in prod.
  await deleteGardenChildRows("garden_orders", existing.id);
  await deleteGardenChildRows("garden_ready_shelf", existing.id);
  await deleteGardenChildRows("garden_editions", existing.id);
  await deleteGardenChildRows("garden_mutations", existing.id);
  await deleteGardenChildRows("garden_participant_marks", existing.id);
  await deleteGardenChildRows("garden_chapters", existing.id);
  const { error } = await supabaseAdmin.from("gardens").delete().eq("id", existing.id);
  if (error) throw new Error(error.message);
  return existing;
}

export async function listChapters(gardenId: string): Promise<GardenChapter[]> {
  if (USE_LOCAL()) return localListChapters(gardenId);
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("garden_chapters")
    .select("*")
    .eq("garden_id", gardenId)
    .order("idx", { ascending: true });
  if (error) {
    console.warn("[gardens] list chapters failed:", error.message);
    return [];
  }
  return (data ?? []).map((r) => rowToChapter(r as Record<string, unknown>));
}

export async function getChapterByEventId(eventId: string): Promise<GardenChapter | null> {
  if (USE_LOCAL()) return localGetChapterByEventId(eventId);
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("garden_chapters")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) {
    console.warn("[gardens] chapter by event failed:", error.message);
    return null;
  }
  return data ? rowToChapter(data as Record<string, unknown>) : null;
}

export async function addChapter(input: {
  gardenId: string;
  eventId: string;
  index: number;
  label?: string;
  chapterWeight?: number;
  status?: GardenChapter["status"];
  opensAt?: string | null;
  closesAt?: string | null;
}): Promise<GardenChapter> {
  if (USE_LOCAL()) return localAddChapter(input);
  if (!supabaseAdmin) throw new Error("Database not configured.");
  const { data, error } = await supabaseAdmin
    .from("garden_chapters")
    .insert({
      garden_id: input.gardenId,
      event_id: input.eventId,
      idx: input.index,
      label: input.label?.trim() || `Show ${input.index}`,
      chapter_weight: input.chapterWeight ?? 1,
      status: input.status ?? "open",
      opens_at: input.opensAt ?? null,
      closes_at: input.closesAt ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to add chapter.");
  return rowToChapter(data as Record<string, unknown>);
}

export async function listMarks(gardenId: string, deviceId: string): Promise<ParticipantMark[]> {
  if (USE_LOCAL()) return localListMarks(gardenId, deviceId);
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("garden_participant_marks")
    .select("*")
    .eq("garden_id", gardenId)
    .eq("device_id", deviceId)
    .order("idx", { ascending: true });
  if (error) {
    console.warn("[gardens] list marks failed:", error.message);
    return [];
  }
  return (data ?? []).map((r) => rowToMark(r as Record<string, unknown>));
}

async function recentDeviceMutationAts(
  gardenId: string,
  deviceId: string
): Promise<string[]> {
  if (USE_LOCAL()) return localRecentDeviceMutationAts(gardenId, deviceId);
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("garden_mutations")
    .select("created_at")
    .eq("garden_id", gardenId)
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return data.map((r) => String((r as { created_at: string }).created_at)).reverse();
}

export type RecordContributionResult = {
  garden: Garden;
  effects: WorldEffect[];
  worldVersion: number;
  mark: ParticipantMark | null;
};

/**
 * Apply a contribution mutation when the event is linked to a garden chapter.
 * Safe no-op (returns null) when there is no chapter, garden is missing, or tables aren't migrated.
 */
export async function recordGardenContribution(args: {
  eventId: string;
  kind: ContributionKind;
  sourceType: "clip" | "turn";
  sourceId: string;
  deviceId?: string | null;
}): Promise<RecordContributionResult | null> {
  try {
    const chapter = await getChapterByEventId(args.eventId);
    if (!chapter) return null;
    const garden = await getGardenByIdOrSlug(chapter.gardenId);
    if (!garden) return null;
    if (garden.status === "archived") return null;

    const deviceId = args.deviceId?.trim() || null;
    const recent = deviceId
      ? await recentDeviceMutationAts(garden.id, deviceId)
      : [];

    const applied = applyMutation(
      garden.worldState,
      {
        gardenId: garden.id,
        chapterId: chapter.id,
        kind: args.kind,
        sourceType: args.sourceType,
        sourceId: args.sourceId,
        deviceId,
        chapterIndex: chapter.index,
        chapterWeight: chapter.chapterWeight,
        recentDeviceMutationAts: recent,
      },
      garden.mutationPolicy
    );

    if (USE_LOCAL()) {
      const persisted = localPersistMutation({
        gardenId: garden.id,
        chapterId: chapter.id,
        deviceId,
        kind: args.kind,
        sourceType: args.sourceType,
        sourceId: args.sourceId,
        delta: applied.delta,
        effects: applied.effects,
        nextState: applied.nextState,
        markIndex: applied.markIndex,
      });
      return {
        garden: persisted.garden,
        effects: applied.effects,
        worldVersion: persisted.garden.worldVersion,
        mark: persisted.mark,
      };
    }

    if (!supabaseAdmin) return null;

    const now = new Date().toISOString();
    const { data: updated, error: upErr } = await supabaseAdmin
      .from("gardens")
      .update({
        world_state: applied.nextState,
        world_version: applied.nextState.version,
        updated_at: now,
      })
      .eq("id", garden.id)
      .eq("world_version", garden.worldVersion)
      .select("*")
      .maybeSingle();

    if (upErr) {
      console.warn("[gardens] mutation update failed:", upErr.message);
      return null;
    }
    if (!updated) {
      // Concurrent write — retry once with fresh state
      const fresh = await getGardenByIdOrSlug(garden.id);
      if (!fresh) return null;
      const retry = applyMutation(
        fresh.worldState,
        {
          gardenId: fresh.id,
          chapterId: chapter.id,
          kind: args.kind,
          sourceType: args.sourceType,
          sourceId: args.sourceId,
          deviceId,
          chapterIndex: chapter.index,
          chapterWeight: chapter.chapterWeight,
          recentDeviceMutationAts: recent,
        },
        fresh.mutationPolicy
      );
      const { data: updated2, error: upErr2 } = await supabaseAdmin
        .from("gardens")
        .update({
          world_state: retry.nextState,
          world_version: retry.nextState.version,
          updated_at: new Date().toISOString(),
        })
        .eq("id", fresh.id)
        .eq("world_version", fresh.worldVersion)
        .select("*")
        .maybeSingle();
      if (upErr2 || !updated2) {
        console.warn("[gardens] mutation retry failed:", upErr2?.message);
        return null;
      }
      await insertMutationAndMark({
        gardenId: fresh.id,
        chapterId: chapter.id,
        deviceId,
        kind: args.kind,
        sourceType: args.sourceType,
        sourceId: args.sourceId,
        delta: retry.delta,
        effects: retry.effects,
        worldVersion: retry.nextState.version,
        markIndex: retry.markIndex,
      });
      return {
        garden: rowToGarden(updated2 as Record<string, unknown>),
        effects: retry.effects,
        worldVersion: retry.nextState.version,
        mark: null,
      };
    }

    await insertMutationAndMark({
      gardenId: garden.id,
      chapterId: chapter.id,
      deviceId,
      kind: args.kind,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      delta: applied.delta,
      effects: applied.effects,
      worldVersion: applied.nextState.version,
      markIndex: applied.markIndex,
    });

    return {
      garden: rowToGarden(updated as Record<string, unknown>),
      effects: applied.effects,
      worldVersion: applied.nextState.version,
      mark: null,
    };
  } catch (err) {
    console.warn("[gardens] recordGardenContribution error:", err);
    return null;
  }
}

async function insertMutationAndMark(args: {
  gardenId: string;
  chapterId: string | null;
  deviceId: string | null;
  kind: ContributionKind;
  sourceType: GardenSourceType;
  sourceId: string;
  delta: Record<string, unknown>;
  effects: WorldEffect[];
  worldVersion: number;
  markIndex: number;
}): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from("garden_mutations").insert({
    garden_id: args.gardenId,
    chapter_id: args.chapterId,
    device_id: args.deviceId,
    kind: args.kind,
    source_type: args.sourceType,
    source_id: args.sourceId,
    delta: args.delta,
    effects: args.effects,
    world_version: args.worldVersion,
  });
  if (args.deviceId) {
    await supabaseAdmin.from("garden_participant_marks").insert({
      garden_id: args.gardenId,
      device_id: args.deviceId,
      kind: args.kind,
      idx: args.markIndex,
      source_type: args.sourceType,
      source_id: args.sourceId,
    });
  }
}

async function persistAppliedMutation(args: {
  garden: Garden;
  chapterId: string | null;
  deviceId: string | null;
  kind: ContributionKind;
  sourceType: GardenSourceType;
  sourceId: string;
  applied: {
    nextState: WorldState;
    effects: WorldEffect[];
    delta: Record<string, unknown>;
    markIndex: number;
  };
}): Promise<RecordContributionResult | null> {
  const { garden, applied } = args;
  if (USE_LOCAL()) {
    const persisted = localPersistMutation({
      gardenId: garden.id,
      chapterId: args.chapterId,
      deviceId: args.deviceId,
      kind: args.kind,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      delta: applied.delta,
      effects: applied.effects,
      nextState: applied.nextState,
      markIndex: applied.markIndex,
    });
    return {
      garden: persisted.garden,
      effects: applied.effects,
      worldVersion: persisted.garden.worldVersion,
      mark: persisted.mark,
    };
  }
  if (!supabaseAdmin) return null;

  const now = new Date().toISOString();
  const { data: updated, error: upErr } = await supabaseAdmin
    .from("gardens")
    .update({
      world_state: applied.nextState,
      world_version: applied.nextState.version,
      updated_at: now,
    })
    .eq("id", garden.id)
    .eq("world_version", garden.worldVersion)
    .select("*")
    .maybeSingle();

  if (upErr || !updated) {
    console.warn("[gardens] persist mutation failed:", upErr?.message ?? "version conflict");
    return null;
  }

  await insertMutationAndMark({
    gardenId: garden.id,
    chapterId: args.chapterId,
    deviceId: args.deviceId,
    kind: args.kind,
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    delta: applied.delta,
    effects: applied.effects,
    worldVersion: applied.nextState.version,
    markIndex: applied.markIndex,
  });

  return {
    garden: rowToGarden(updated as Record<string, unknown>),
    effects: applied.effects,
    worldVersion: applied.nextState.version,
    mark: null,
  };
}

async function resolveEventSlug(eventId: string): Promise<string> {
  if (USE_LOCAL()) {
    return localEventsGetById(eventId)?.slug ?? "";
  }
  if (!supabaseAdmin) return "";
  const { data } = await supabaseAdmin
    .from("events")
    .select("slug")
    .eq("id", eventId)
    .maybeSingle();
  return data?.slug ? String(data.slug) : "";
}

export async function listRecentMutations(
  gardenId: string,
  limit = 40
): Promise<GardenMutationRecord[]> {
  if (USE_LOCAL()) return localListMutations(gardenId, { limit });
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("garden_mutations")
    .select("*")
    .eq("garden_id", gardenId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) {
    console.warn("[gardens] list mutations failed:", error?.message);
    return [];
  }
  return data.map((r) => rowToMutation(r as Record<string, unknown>));
}

export async function listMutationsThrough(
  gardenId: string,
  beforeIso: string
): Promise<GardenMutationRecord[]> {
  if (USE_LOCAL()) return localListMutations(gardenId, { beforeIso });
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("garden_mutations")
    .select("*")
    .eq("garden_id", gardenId)
    .lte("created_at", beforeIso)
    .order("created_at", { ascending: true });
  if (error || !data) {
    console.warn("[gardens] list mutations through failed:", error?.message);
    return [];
  }
  return data.map((r) => rowToMutation(r as Record<string, unknown>));
}

export async function updateChapter(
  chapterId: string,
  updates: Partial<Pick<GardenChapter, "status" | "label" | "chapterWeight" | "opensAt" | "closesAt">>
): Promise<GardenChapter | null> {
  if (USE_LOCAL()) return localUpdateChapter(chapterId, updates);
  if (!supabaseAdmin) throw new Error("Database not configured.");
  const patch: Record<string, unknown> = {};
  if (updates.status != null) patch.status = updates.status;
  if (updates.label != null) patch.label = updates.label;
  if (updates.chapterWeight != null) patch.chapter_weight = updates.chapterWeight;
  if (updates.opensAt !== undefined) patch.opens_at = updates.opensAt;
  if (updates.closesAt !== undefined) patch.closes_at = updates.closesAt;
  const { data, error } = await supabaseAdmin
    .from("garden_chapters")
    .update(patch)
    .eq("id", chapterId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to update chapter.");
  return rowToChapter(data as Record<string, unknown>);
}

export async function getChapterById(chapterId: string): Promise<GardenChapter | null> {
  if (USE_LOCAL()) return localGetChapterById(chapterId);
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("garden_chapters")
    .select("*")
    .eq("id", chapterId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToChapter(data as Record<string, unknown>);
}

/**
 * Between-show pulse — allowed when garden is live and no chapter is required.
 */
export async function recordBetweenShowPulse(args: {
  gardenIdOrSlug: string;
  kind?: ContributionKind;
  deviceId?: string | null;
  note?: string | null;
  zoneKey?: string | null;
}): Promise<RecordContributionResult | null> {
  try {
    const garden = await getGardenByIdOrSlug(args.gardenIdOrSlug);
    if (!garden || garden.status !== "live") return null;

    const chapters = await listChapters(garden.id);
    const open = chapters.find((c) => c.status === "open") ?? null;
    const deviceId = args.deviceId?.trim() || null;
    const recent = deviceId ? await recentDeviceMutationAts(garden.id, deviceId) : [];
    const kind = args.kind && isContributionKind(args.kind) ? args.kind : "text";
    const weight = open
      ? open.chapterWeight
      : garden.mutationPolicy.betweenChapterWeight;

    const zoneKeyRaw = args.zoneKey?.trim() || null;
    const knownZones = garden.brandKit.zones ?? [];
    let zoneKey: string | null = null;
    if (zoneKeyRaw) {
      if (knownZones.length === 0 || knownZones.some((z) => z.key === zoneKeyRaw)) {
        zoneKey = zoneKeyRaw;
      } else {
        return null; // invalid zone for authored map
      }
    }

    const applied = applyMutation(
      garden.worldState,
      {
        gardenId: garden.id,
        chapterId: open?.id ?? null,
        kind,
        sourceType: "pulse",
        sourceId: `pulse_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        deviceId,
        chapterIndex: open?.index ?? null,
        chapterWeight: weight,
        zoneKey,
        recentDeviceMutationAts: recent,
      },
      garden.mutationPolicy
    );

    const note = args.note?.trim().slice(0, 280) || null;
    if (note) {
      applied.delta = { ...applied.delta, note };
    }

    return persistAppliedMutation({
      garden,
      chapterId: open?.id ?? null,
      deviceId,
      kind,
      sourceType: "pulse",
      sourceId: String(applied.delta.nodeId ?? `pulse_${Date.now()}`),
      applied,
    });
  } catch (err) {
    console.warn("[gardens] recordBetweenShowPulse error:", err);
    return null;
  }
}

export async function finalizeChapter(args: {
  gardenIdOrSlug: string;
  chapterId: string;
}): Promise<{ chapter: GardenChapter; result: RecordContributionResult } | null> {
  try {
    const garden = await getGardenByIdOrSlug(args.gardenIdOrSlug);
    if (!garden) return null;
    const chapter = await getChapterById(args.chapterId);
    if (!chapter || chapter.gardenId !== garden.id) return null;
    if (chapter.status === "closed") {
      return null;
    }

    const applied = applyChapterFinale(
      garden.worldState,
      {
        gardenId: garden.id,
        chapterId: chapter.id,
        chapterIndex: chapter.index,
        chapterLabel: chapter.label,
      },
      garden.mutationPolicy
    );

    const result = await persistAppliedMutation({
      garden,
      chapterId: chapter.id,
      deviceId: null,
      kind: "other",
      sourceType: "finale",
      sourceId: `finale_${chapter.id}`,
      applied,
    });
    if (!result) return null;

    const updatedChapter = await updateChapter(chapter.id, {
      status: "closed",
      closesAt: new Date().toISOString(),
    });
    if (!updatedChapter) return null;
    return { chapter: updatedChapter, result };
  } catch (err) {
    console.warn("[gardens] finalizeChapter error:", err);
    return null;
  }
}

export async function getGardenSnapshot(args: {
  gardenIdOrSlug: string;
  chapterId?: string | null;
  eventId?: string | null;
  deviceId?: string | null;
  at?: string | null;
  version?: number | null;
}): Promise<GardenSnapshot | null> {
  const garden = await getGardenByIdOrSlug(args.gardenIdOrSlug);
  if (!garden) return null;

  let chapter: GardenChapter | null = null;
  if (args.chapterId) {
    const chapters = await listChapters(garden.id);
    chapter = chapters.find((c) => c.id === args.chapterId) ?? null;
  } else if (args.eventId) {
    chapter = await getChapterByEventId(args.eventId);
  } else {
    const chapters = await listChapters(garden.id);
    chapter =
      chapters.find((c) => c.status === "open") ??
      chapters[chapters.length - 1] ??
      null;
  }

  const eventSlug = chapter ? await resolveEventSlug(chapter.eventId) : "";
  const myMarks =
    args.deviceId && args.deviceId.trim() && !args.at && args.version == null
      ? await listMarks(garden.id, args.deviceId.trim())
      : [];

  let gardenForSnap = garden;
  let asOf: string | null = null;

  if (args.at || args.version != null) {
    const mutations = args.at
      ? await listMutationsThrough(garden.id, args.at)
      : await listMutationsThrough(garden.id, new Date().toISOString());
    const filtered =
      args.version != null
        ? mutations.filter((m) => m.worldVersion <= Number(args.version))
        : mutations;
    const rebuilt = replayMutationsToState({
      gardenId: garden.id,
      renderSeed: garden.worldState.renderSeed || `garden_${garden.id.slice(0, 8)}`,
      policy: garden.mutationPolicy,
      mutations: filtered,
    });
    // Align reported version to last mutation version when available
    const lastVersion = filtered.length
      ? filtered[filtered.length - 1].worldVersion
      : 0;
    rebuilt.version = lastVersion;
    gardenForSnap = {
      ...garden,
      worldState: rebuilt,
      worldVersion: lastVersion,
    };
    asOf = args.at ?? filtered[filtered.length - 1]?.createdAt ?? null;
  }

  // For event-scoped snapshots, prefer chapter window; for garden home, use open chapter or between.
  const windowChapter =
    args.eventId && chapter
      ? chapter
      : (await listChapters(garden.id)).find((c) => c.status === "open") ?? null;

  const snapshot = buildGardenSnapshot({
    garden: gardenForSnap,
    chapter,
    eventSlug,
    myMarks,
    asOf,
    window: resolveContributionWindow({
      gardenStatus: garden.status,
      activeChapter: windowChapter,
    }),
  });

  const journeyIds = Array.from(
    new Set(
      snapshot.zones
        .map((z) => (z.engageMode === "journey" ? z.journeyEventId : null))
        .filter((id): id is string => Boolean(id))
    )
  );
  if (journeyIds.length === 0) return snapshot;

  const slugEntries = await Promise.all(
    journeyIds.map(async (id) => [id, await resolveEventSlug(id)] as const)
  );
  const slugById = Object.fromEntries(slugEntries);

  return {
    ...snapshot,
    zones: snapshot.zones.map((z) => ({
      ...z,
      journeyEventSlug:
        z.engageMode === "journey" && z.journeyEventId
          ? slugById[z.journeyEventId] || null
          : null,
    })),
  };
}

export async function getEventGardenSnapshot(args: {
  eventId: string;
  deviceId?: string | null;
}): Promise<GardenSnapshot | null> {
  const chapter = await getChapterByEventId(args.eventId);
  if (!chapter) return null;
  return getGardenSnapshot({
    gardenIdOrSlug: chapter.gardenId,
    eventId: args.eventId,
    deviceId: args.deviceId,
  });
}

export function kindFromSonggardenCategory(category: string): ContributionKind {
  if (category === "percussion") return "percussion";
  if (category === "vocal") return "vocal";
  return "other";
}

export function kindFromInterviewMedia(args: {
  content: string;
  hasAudio: boolean;
  hasVideo: boolean;
}): ContributionKind | null {
  const content = args.content.trim();
  if (!content && !args.hasAudio && !args.hasVideo) return null;
  if (args.hasVideo) return "video";
  if (args.hasAudio) return "voice";
  return "text";
}

function rowToEdition(row: Record<string, unknown>): GardenEdition {
  return {
    id: String(row.id),
    gardenId: String(row.garden_id),
    slug: String(row.slug),
    label: String(row.label ?? ""),
    pinnedSnapshot: row.pinned_snapshot as PinnedMerchSnapshot,
    renderSeed: String(row.render_seed ?? ""),
    pinnedAt: String(row.pinned_at ?? new Date().toISOString()),
  };
}

function rowToOrder(row: Record<string, unknown>): GardenOrder {
  return {
    id: String(row.id),
    gardenId: String(row.garden_id),
    kind: (row.kind as GardenOrderKind) || "living",
    editionId: row.edition_id != null ? String(row.edition_id) : null,
    editionSlug: row.edition_slug != null ? String(row.edition_slug) : null,
    format: isMerchFormat(row.format) ? row.format : "square_print",
    deviceId: row.device_id != null ? String(row.device_id) : null,
    orderedSnapshot: row.ordered_snapshot as PinnedMerchSnapshot,
    merchInput: row.merch_input as MerchRenderInput,
    status: (row.status as GardenOrder["status"]) || "stub",
    note: row.note != null ? String(row.note) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function listEditions(gardenId: string): Promise<GardenEdition[]> {
  if (USE_LOCAL()) return localListEditions(gardenId);
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("garden_editions")
    .select("*")
    .eq("garden_id", gardenId)
    .order("pinned_at", { ascending: false });
  if (error || !data) {
    console.warn("[gardens] list editions failed:", error?.message);
    return [];
  }
  return data.map((r) => rowToEdition(r as Record<string, unknown>));
}

export async function getEdition(
  gardenId: string,
  editionIdOrSlug: string
): Promise<GardenEdition | null> {
  if (USE_LOCAL()) return localGetEdition(gardenId, editionIdOrSlug);
  if (!supabaseAdmin) return null;
  const byId = await supabaseAdmin
    .from("garden_editions")
    .select("*")
    .eq("garden_id", gardenId)
    .eq("id", editionIdOrSlug)
    .maybeSingle();
  if (byId.data) return rowToEdition(byId.data as Record<string, unknown>);
  const bySlug = await supabaseAdmin
    .from("garden_editions")
    .select("*")
    .eq("garden_id", gardenId)
    .eq("slug", editionIdOrSlug)
    .maybeSingle();
  if (bySlug.data) return rowToEdition(bySlug.data as Record<string, unknown>);
  return null;
}

/** Pin the current (or historical) garden state as a monthly edition. */
export async function pinGardenEdition(args: {
  gardenIdOrSlug: string;
  slug: string;
  label: string;
  at?: string | null;
  version?: number | null;
}): Promise<GardenEdition> {
  const garden = await getGardenByIdOrSlug(args.gardenIdOrSlug);
  if (!garden) throw new Error("Garden not found.");

  let state = garden.worldState;
  let worldVersion = garden.worldVersion;
  if (args.at || args.version != null) {
    const snap = await getGardenSnapshot({
      gardenIdOrSlug: garden.id,
      at: args.at,
      version: args.version,
    });
    if (!snap) throw new Error("Could not rebuild historical snapshot for edition.");
    state = snap.state;
    worldVersion = snap.garden.worldVersion;
  }

  const pinnedSnapshot = buildPinnedMerchSnapshot({
    garden,
    state,
    worldVersion,
  });
  const renderSeed = `${state.renderSeed}:edition:${args.slug.trim()}:v${worldVersion}`;

  if (USE_LOCAL()) {
    return localCreateEdition({
      gardenId: garden.id,
      slug: args.slug,
      label: args.label,
      pinnedSnapshot,
      renderSeed,
    });
  }
  if (!supabaseAdmin) throw new Error("Database not configured.");
  const slug = args.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const { data, error } = await supabaseAdmin
    .from("garden_editions")
    .insert({
      garden_id: garden.id,
      slug,
      label: args.label.trim() || slug,
      pinned_snapshot: pinnedSnapshot,
      render_seed: renderSeed,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to pin edition.");
  return rowToEdition(data as Record<string, unknown>);
}

export async function listOrders(gardenId: string): Promise<GardenOrder[]> {
  if (USE_LOCAL()) return localListOrders(gardenId);
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("garden_orders")
    .select("*")
    .eq("garden_id", gardenId)
    .order("created_at", { ascending: false });
  if (error || !data) {
    console.warn("[gardens] list orders failed:", error?.message);
    return [];
  }
  return data.map((r) => rowToOrder(r as Record<string, unknown>));
}

export async function getOrder(orderId: string): Promise<GardenOrder | null> {
  if (USE_LOCAL()) return localGetOrder(orderId);
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("garden_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToOrder(data as Record<string, unknown>);
}

/**
 * Stub checkout — freezes the print contract (edition pin or living snapshot) on the order.
 */
export async function createStubOrder(args: {
  gardenIdOrSlug: string;
  kind: GardenOrderKind;
  format: MerchFormat;
  editionIdOrSlug?: string | null;
  deviceId?: string | null;
  note?: string | null;
}): Promise<GardenOrder> {
  const garden = await getGardenByIdOrSlug(args.gardenIdOrSlug);
  if (!garden) throw new Error("Garden not found.");

  let edition: GardenEdition | null = null;
  let orderedSnapshot: PinnedMerchSnapshot;
  let merchInput: MerchRenderInput;
  const marks =
    args.deviceId?.trim()
      ? await listMarks(garden.id, args.deviceId.trim())
      : [];

  if (args.kind === "edition") {
    if (!args.editionIdOrSlug?.trim()) {
      throw new Error("editionIdOrSlug is required for edition orders.");
    }
    edition = await getEdition(garden.id, args.editionIdOrSlug.trim());
    if (!edition) throw new Error("Edition not found.");
    orderedSnapshot = edition.pinnedSnapshot;
    merchInput = editionToMerchInput(edition, args.format, marks);
  } else {
    orderedSnapshot = buildPinnedMerchSnapshot({ garden });
    merchInput = buildMerchRenderInput({
      brand: garden.brandKit,
      state: {
        energy: garden.worldState.energy,
        layers: garden.worldState.layers,
        landmarks: garden.worldState.landmarks,
        totals: garden.worldState.totals,
        renderSeed: garden.worldState.renderSeed,
        version: garden.worldState.version,
      },
      format: args.format,
      personalMarks: marks,
    });
  }

  if (USE_LOCAL()) {
    return localCreateOrder({
      gardenId: garden.id,
      kind: args.kind,
      editionId: edition?.id ?? null,
      editionSlug: edition?.slug ?? null,
      format: args.format,
      deviceId: args.deviceId?.trim() || null,
      orderedSnapshot,
      merchInput,
      status: "stub",
      note: args.note?.trim() || null,
    });
  }
  if (!supabaseAdmin) throw new Error("Database not configured.");
  const { data, error } = await supabaseAdmin
    .from("garden_orders")
    .insert({
      garden_id: garden.id,
      kind: args.kind,
      edition_id: edition?.id ?? null,
      edition_slug: edition?.slug ?? null,
      format: args.format,
      device_id: args.deviceId?.trim() || null,
      ordered_snapshot: orderedSnapshot,
      merch_input: merchInput,
      status: "stub",
      note: args.note?.trim() || null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create order.");
  return rowToOrder(data as Record<string, unknown>);
}

export async function resolveMerchPreviewInput(args: {
  gardenIdOrSlug: string;
  format: MerchFormat;
  editionIdOrSlug?: string | null;
  living?: boolean;
  deviceId?: string | null;
  at?: string | null;
  version?: number | null;
}): Promise<{ garden: Garden; input: MerchRenderInput; edition: GardenEdition | null }> {
  const garden = await getGardenByIdOrSlug(args.gardenIdOrSlug);
  if (!garden) throw new Error("Garden not found.");
  const marks =
    args.deviceId?.trim()
      ? await listMarks(garden.id, args.deviceId.trim())
      : [];

  if (args.editionIdOrSlug?.trim() && !args.living) {
    const edition = await getEdition(garden.id, args.editionIdOrSlug.trim());
    if (!edition) throw new Error("Edition not found.");
    return {
      garden,
      edition,
      input: editionToMerchInput(edition, args.format, marks),
    };
  }

  let state = garden.worldState;
  if (args.at || args.version != null) {
    const snap = await getGardenSnapshot({
      gardenIdOrSlug: garden.id,
      at: args.at,
      version: args.version,
    });
    if (snap) state = snap.state;
  }

  return {
    garden,
    edition: null,
    input: buildMerchRenderInput({
      brand: garden.brandKit,
      state: {
        energy: state.energy,
        layers: state.layers,
        landmarks: state.landmarks,
        totals: state.totals,
        renderSeed: state.renderSeed,
        version: state.version,
      },
      format: args.format,
      personalMarks: marks,
    }),
  };
}

function rowToReadyItem(row: Record<string, unknown>): GamedayReadyItem {
  return {
    id: String(row.id),
    gardenId: String(row.garden_id),
    title: String(row.title ?? ""),
    momentType: (row.moment_type as GamedayMomentType) || "general",
    zoneKey: row.zone_key != null ? String(row.zone_key) : null,
    sponsorKey: row.sponsor_key != null ? String(row.sponsor_key) : null,
    sourceType: (row.source_type as GamedayReadyItem["sourceType"]) || "manual",
    sourceId: row.source_id != null ? String(row.source_id) : null,
    note: row.note != null ? String(row.note) : null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    status: (row.status as GamedayReadyItem["status"]) || "ready",
    sortIndex: Number(row.sort_index) || 0,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function listReadyShelf(gardenId: string): Promise<GamedayReadyItem[]> {
  if (USE_LOCAL()) return localListReadyShelf(gardenId);
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("garden_ready_shelf")
    .select("*")
    .eq("garden_id", gardenId)
    .order("sort_index", { ascending: true })
    .order("created_at", { ascending: false });
  if (error || !data) {
    console.warn("[gardens] list ready shelf failed:", error?.message);
    return [];
  }
  return data.map((r) => rowToReadyItem(r as Record<string, unknown>));
}

export async function createReadyShelfItem(args: {
  gardenIdOrSlug: string;
  title: string;
  momentType?: GamedayMomentType;
  zoneKey?: string | null;
  sponsorKey?: string | null;
  sourceType?: GamedayReadyItem["sourceType"];
  sourceId?: string | null;
  note?: string | null;
  payload?: Record<string, unknown>;
  sortIndex?: number;
}): Promise<GamedayReadyItem> {
  const garden = await getGardenByIdOrSlug(args.gardenIdOrSlug);
  if (!garden) throw new Error("Garden not found.");
  const title = args.title.trim();
  if (!title) throw new Error("title is required");

  if (USE_LOCAL()) {
    return localCreateReadyItem({
      gardenId: garden.id,
      title,
      momentType: args.momentType ?? "general",
      zoneKey: args.zoneKey?.trim() || null,
      sponsorKey: args.sponsorKey?.trim() || null,
      sourceType: args.sourceType ?? "manual",
      sourceId: args.sourceId ?? null,
      note: args.note?.trim() || null,
      payload: args.payload ?? {},
      status: "ready",
      sortIndex: args.sortIndex ?? 0,
    });
  }
  if (!supabaseAdmin) throw new Error("Database not configured.");
  const { data, error } = await supabaseAdmin
    .from("garden_ready_shelf")
    .insert({
      garden_id: garden.id,
      title,
      moment_type: args.momentType ?? "general",
      zone_key: args.zoneKey?.trim() || null,
      sponsor_key: args.sponsorKey?.trim() || null,
      source_type: args.sourceType ?? "manual",
      source_id: args.sourceId ?? null,
      note: args.note?.trim() || null,
      payload: args.payload ?? {},
      status: "ready",
      sort_index: args.sortIndex ?? 0,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create ready item.");
  return rowToReadyItem(data as Record<string, unknown>);
}

export async function updateReadyShelfItem(
  itemId: string,
  updates: Partial<
    Pick<
      GamedayReadyItem,
      "title" | "momentType" | "zoneKey" | "sponsorKey" | "note" | "payload" | "status" | "sortIndex"
    >
  >
): Promise<GamedayReadyItem | null> {
  if (USE_LOCAL()) return localUpdateReadyItem(itemId, updates);
  if (!supabaseAdmin) throw new Error("Database not configured.");
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title != null) patch.title = updates.title;
  if (updates.momentType != null) patch.moment_type = updates.momentType;
  if (updates.zoneKey !== undefined) patch.zone_key = updates.zoneKey;
  if (updates.sponsorKey !== undefined) patch.sponsor_key = updates.sponsorKey;
  if (updates.note !== undefined) patch.note = updates.note;
  if (updates.payload != null) patch.payload = updates.payload;
  if (updates.status != null) patch.status = updates.status;
  if (updates.sortIndex != null) patch.sort_index = updates.sortIndex;
  const { data, error } = await supabaseAdmin
    .from("garden_ready_shelf")
    .update(patch)
    .eq("id", itemId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToReadyItem(data as Record<string, unknown>) : null;
}

/** Promote a recent zone pulse / contribution onto the gameday ready shelf. */
export async function promoteToReadyShelf(args: {
  gardenIdOrSlug: string;
  title: string;
  momentType?: GamedayMomentType;
  zoneKey?: string | null;
  note?: string | null;
}): Promise<GamedayReadyItem> {
  const garden = await getGardenByIdOrSlug(args.gardenIdOrSlug);
  if (!garden) throw new Error("Garden not found.");
  const zoneKey = args.zoneKey?.trim() || null;
  const zoneDef = zoneKey
    ? garden.brandKit.zones.find((z) => z.key === zoneKey) ?? null
    : null;
  const runtime = zoneKey ? garden.worldState.zones?.[zoneKey] ?? null : null;
  const sponsorKey = zoneDef?.sponsorKey ?? null;

  return createReadyShelfItem({
    gardenIdOrSlug: garden.id,
    title: args.title,
    momentType: args.momentType ?? "general",
    zoneKey,
    sponsorKey,
    sourceType: "pulse",
    sourceId: null,
    note: args.note,
    payload: {
      worldVersion: garden.worldVersion,
      energy: garden.worldState.energy,
      zoneEnergy: runtime?.energy ?? null,
      zoneContributions: runtime?.contributions ?? null,
      landmarks: garden.worldState.landmarks.map((l) => l.label),
    },
  });
}

export async function getReadyItem(itemId: string): Promise<GamedayReadyItem | null> {
  if (USE_LOCAL()) return localGetReadyItem(itemId);
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from("garden_ready_shelf")
    .select("*")
    .eq("id", itemId)
    .maybeSingle();
  return data ? rowToReadyItem(data as Record<string, unknown>) : null;
}
