import { supabaseAdmin } from "@/lib/supabase-server";
import { localEventsGetById } from "@/lib/local-events-store";
import { applyMutation } from "./apply-mutation";
import { buildGardenSnapshot } from "./snapshot";
import {
  localAddChapter,
  localCreateGarden,
  localGetChapterByEventId,
  localGetGardenByIdOrSlug,
  localListChapters,
  localListGardens,
  localListMarks,
  localPersistMutation,
  localRecentDeviceMutationAts,
  localUpdateGarden,
} from "./local-garden-store";
import {
  defaultBrandKit,
  defaultMutationPolicy,
  emptyWorldState,
  isContributionKind,
  type BrandKit,
  type ContributionKind,
  type Garden,
  type GardenChapter,
  type GardenKind,
  type GardenSnapshot,
  type GardenStatus,
  type MutationPolicy,
  type ParticipantMark,
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
  return {
    id: String(row.id),
    gardenId: String(row.garden_id),
    deviceId: String(row.device_id),
    kind: isContributionKind(row.kind) ? row.kind : "other",
    index: Number(row.idx) || 0,
    sourceType: row.source_type === "clip" ? "clip" : "turn",
    sourceId: String(row.source_id),
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
  if (updates.brandKit) patch.brand_kit = defaultBrandKit({ ...existing.brandKit, ...updates.brandKit });
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
  sourceType: "clip" | "turn";
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

export async function getGardenSnapshot(args: {
  gardenIdOrSlug: string;
  chapterId?: string | null;
  eventId?: string | null;
  deviceId?: string | null;
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
    args.deviceId && args.deviceId.trim()
      ? await listMarks(garden.id, args.deviceId.trim())
      : [];

  return buildGardenSnapshot({
    garden,
    chapter,
    eventSlug,
    myMarks,
  });
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
