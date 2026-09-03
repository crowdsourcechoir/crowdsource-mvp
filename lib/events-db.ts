import type { SongGardenConfig } from "@/lib/songgarden/config";
import type { WorldConfig, WorldStoryboardFrame } from "@/lib/song-garden-v2/world-config";
import { normalizeWorldConfigInput } from "@/lib/song-garden-v2/world-config";
import { supabaseAdmin } from "@/lib/supabase-server";

const BUCKET = process.env.SONG_GARDEN_MEDIA_BUCKET || "song-garden-world-media";

/**
 * List/admin payloads must stay small. Selecting * pulled multi-MB data-URI
 * heroes and world JSON and tripped Postgres `statement timeout`.
 * Hosted hero URLs are merged separately via attachHostedHeroes().
 */
export const EVENT_LIST_SELECT =
  "id,slug,title,description,date,time,venue,address,prompt,hero_image_mode,landing_headline,landing_copy,cta_text,anthem_completion_message,allow_audio_video_prompt,agent_theme_id";

/** Detail fetch — omit hero_image (data-URI bombs) but keep world_config for edit/journey. */
export const EVENT_DETAIL_SELECT =
  "id,slug,title,description,date,time,venue,address,prompt,hero_image_mode,landing_headline,landing_copy,cta_text,anthem_completion_message,allow_audio_video_prompt,agent_theme_id,agent_brief,song_garden_config,world_config";

/** Keep http(s) / relative heroes; never return inline data-URIs. */
export function hostedHeroUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (!v || v.startsWith("data:")) return "";
  if (/^https?:\/\//i.test(v) || v.startsWith("/")) return v;
  return "";
}

export function rowToEvent(row: Record<string, unknown>) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    date: row.date,
    time: row.time,
    venue: row.venue,
    address: row.address,
    prompt: row.prompt,
    heroImage: hostedHeroUrl(row.hero_image),
    heroImageMode: row.hero_image_mode === "color" ? "color" : "bw",
    landingHeadline:
      (row.landing_headline as string) ??
      "We're crowdsourcing a song for this event. Want to help create it?",
    landingCopy: (row.landing_copy as string) ?? "",
    ctaText: (row.cta_text as string) ?? "Let's make an anthem",
    anthemCompletionMessage:
      (row.anthem_completion_message as string) ??
      "Thanks! Your answers will help shape the song we're making.",
    allowAudioVideoPrompt: (row.allow_audio_video_prompt as boolean) ?? true,
    agentThemeId: row.agent_theme_id ?? null,
    agentBrief: row.agent_brief ?? null,
    songGardenConfig: (row.song_garden_config as SongGardenConfig | null) ?? null,
    journeySteps:
      ((row.song_garden_config as SongGardenConfig | null)?.journeySteps as unknown[] | undefined) ??
      null,
    worldConfig: (row.world_config as WorldConfig | null) ?? null,
  };
}

const SCENE_RE = /^(.+)-scene-(\d+)-\d+\.(jpe?g|png|webp|gif)$/i;
const VIDEO_RE = /^(.+)-frame-(\d+)-\d+\.(mp4|webm)$/i;
/** persistDataUrlMedia: `{id}-hero.jpg`; signed upload: `{id}-hero-{timestamp}.jpg` */
const HERO_FILE_RE = /^(.+)-hero(?:-\d+)?\.(jpe?g|png|webp|gif|heic|heif|avif)$/i;

type StorageFile = { name: string; created_at?: string };

async function listStorageFolder(folder: "storyboards" | "heroes"): Promise<StorageFile[]> {
  if (!supabaseAdmin) return [];
  const out: StorageFile[] = [];
  const pageSize = 100;
  for (let offset = 0; offset < 2000; offset += pageSize) {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(folder, {
      limit: pageSize,
      offset,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error || !data?.length) break;
    out.push(...data.map((f) => ({ name: f.name, created_at: f.created_at })));
    if (data.length < pageSize) break;
  }
  return out;
}

async function listStoryboardFiles(): Promise<StorageFile[]> {
  return listStorageFolder("storyboards");
}

async function listHeroFiles(): Promise<StorageFile[]> {
  return listStorageFolder("heroes");
}

function publicMediaUrl(folder: "storyboards" | "heroes", filename: string): string {
  if (supabaseAdmin) {
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(`${folder}/${filename}`);
    return data.publicUrl;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (base) {
    return `${base}/storage/v1/object/public/${BUCKET}/${folder}/${filename}`;
  }
  return folder === "heroes"
    ? `/song-garden-v2/heroes/${filename}`
    : `/song-garden-v2/world-scenes/generated/${filename}`;
}

export function heroStoragePrefixes(eventId: string, slug?: string | null): string[] {
  const prefixes: string[] = [];
  const push = (value: string) => {
    const key = value.trim().toLowerCase();
    if (key && !prefixes.includes(key)) prefixes.push(key);
  };
  push(eventId);
  push(slug ?? "");
  push(eventId.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64));
  return prefixes;
}

export function newestHeroUrlByPrefix(
  files: StorageFile[],
  toUrl: (filename: string) => string = (name) => publicMediaUrl("heroes", name)
): Map<string, string> {
  const newest = new Map<string, { name: string; created: string }>();
  for (const file of files) {
    const match = HERO_FILE_RE.exec(file.name);
    if (!match) continue;
    const prefix = match[1].toLowerCase();
    const created = file.created_at ?? "";
    const prev = newest.get(prefix);
    if (!prev || created > prev.created || (created === prev.created && file.name > prev.name)) {
      newest.set(prefix, { name: file.name, created });
    }
  }
  const out = new Map<string, string>();
  for (const [prefix, file] of Array.from(newest.entries())) {
    out.set(prefix, toUrl(file.name));
  }
  return out;
}

export function resolveHeroFromStorageFilenames(
  event: { id: string; slug?: string | null },
  urlByPrefix: Map<string, string>
): string {
  for (const prefix of heroStoragePrefixes(event.id, event.slug)) {
    const url = urlByPrefix.get(prefix);
    if (url) return url;
  }
  return "";
}

export type HeroAttachable = { id: unknown; slug?: unknown; heroImage?: string };

/** Apply DB + storage hero URLs onto events. Returns rows to persist (storage recoveries). */
export function applyHeroAttachments(
  events: HeroAttachable[],
  dbHeroById: Map<string, string>,
  urlByPrefix: Map<string, string>
): Array<{ id: string; url: string }> {
  const persist: Array<{ id: string; url: string }> = [];
  for (const event of events) {
    const id = String(event.id);
    const fromDb = hostedHeroUrl(dbHeroById.get(id) ?? event.heroImage);
    if (fromDb) {
      event.heroImage = fromDb;
      continue;
    }
    const fromStorage = resolveHeroFromStorageFilenames(
      { id, slug: typeof event.slug === "string" ? event.slug : null },
      urlByPrefix
    );
    event.heroImage = fromStorage;
    if (fromStorage) persist.push({ id, url: fromStorage });
  }
  return persist;
}

/**
 * Fill heroImage from hosted DB URLs (never data-URIs) and, if still empty,
 * from storage `heroes/{id}-hero*`. Writes recovered URLs back so the next
 * list load stays a cheap SQL filter.
 */
export async function attachHostedHeroes(
  events: HeroAttachable[],
  opts?: { skipStorageScan?: boolean }
): Promise<void> {
  if (!events.length) return;

  const dbHeroById = new Map<string, string>();
  if (supabaseAdmin) {
    try {
      const ids = events.map((e) => String(e.id)).filter(Boolean);
      if (ids.length) {
        const { data, error } = await supabaseAdmin
          .from("events")
          .select("id, hero_image")
          .in("id", ids)
          .not("hero_image", "is", null)
          .neq("hero_image", "")
          .not("hero_image", "like", "data:%");
        if (!error && data) {
          for (const row of data) {
            const url = hostedHeroUrl((row as { hero_image?: unknown }).hero_image);
            if (url) dbHeroById.set(String((row as { id: unknown }).id), url);
          }
        }
      }
    } catch (err) {
      console.error("[events] hosted hero lookup failed:", err);
    }
  }

  const missing = events.filter(
    (e) => !hostedHeroUrl(dbHeroById.get(String(e.id)) ?? e.heroImage)
  );
  let urlByPrefix = new Map<string, string>();
  if (missing.length && !opts?.skipStorageScan) {
    try {
      const files = await listHeroFiles();
      urlByPrefix = newestHeroUrlByPrefix(files);
    } catch (err) {
      console.error("[events] hero storage listing failed:", err);
    }
  }

  let persist: Array<{ id: string; url: string }> = [];
  if (opts?.skipStorageScan) {
    for (const e of events) {
      const url = hostedHeroUrl(dbHeroById.get(String(e.id)) ?? e.heroImage);
      if (url) e.heroImage = url;
    }
  } else {
    persist = applyHeroAttachments(events, dbHeroById, urlByPrefix);
  }

  const db = supabaseAdmin;
  if (persist.length && db) {
    await Promise.all(
      persist.map(({ id, url }) =>
        db.from("events").update({ hero_image: url }).eq("id", id)
      )
    );
  }
}

function publicStoryboardUrl(filename: string): string {
  return publicMediaUrl("storyboards", filename);
}

export type RecoveredStoryboard = {
  prefix: string;
  frames: WorldStoryboardFrame[];
};

/** Group persisted Runway stills/loops by the event slug or id used at generate time. */
export function groupStoryboardFiles(files: StorageFile[]): Map<string, WorldStoryboardFrame[]> {
  const newestScene = new Map<string, { name: string; created?: string }>();
  const newestVideo = new Map<string, { name: string; created?: string }>();

  function consider(
    map: Map<string, { name: string; created?: string }>,
    key: string,
    name: string,
    created?: string
  ) {
    const prev = map.get(key);
    if (!prev || (created && prev.created && created > prev.created) || (created && !prev.created)) {
      map.set(key, { name, created });
    }
  }

  for (const file of files) {
    const scene = SCENE_RE.exec(file.name);
    if (scene) {
      consider(newestScene, `${scene[1].toLowerCase()}::${scene[2]}`, file.name, file.created_at);
      continue;
    }
    const video = VIDEO_RE.exec(file.name);
    if (video) {
      consider(newestVideo, `${video[1].toLowerCase()}::${video[2]}`, file.name, file.created_at);
    }
  }

  const byPrefix = new Map<string, Map<number, WorldStoryboardFrame>>();
  function frameSlot(prefix: string, index: number): WorldStoryboardFrame {
    let slots = byPrefix.get(prefix);
    if (!slots) {
      slots = new Map();
      byPrefix.set(prefix, slots);
    }
    let frame = slots.get(index);
    if (!frame) {
      frame = { sceneUrl: null, videoUrl: null };
      slots.set(index, frame);
    }
    return frame;
  }

  for (const [key, file] of Array.from(newestScene.entries())) {
    const [prefix, idx] = key.split("::");
    frameSlot(prefix, Number(idx) - 1).sceneUrl = publicStoryboardUrl(file.name);
  }
  for (const [key, file] of Array.from(newestVideo.entries())) {
    const [prefix, idx] = key.split("::");
    frameSlot(prefix, Number(idx) - 1).videoUrl = publicStoryboardUrl(file.name);
  }

  const grouped = new Map<string, WorldStoryboardFrame[]>();
  for (const [prefix, slots] of Array.from(byPrefix.entries())) {
    const max = Math.max(...Array.from(slots.keys()));
    const frames: WorldStoryboardFrame[] = [];
    for (let i = 0; i <= max; i += 1) {
      frames.push(slots.get(i) ?? { sceneUrl: null, videoUrl: null });
    }
    grouped.set(prefix, frames);
  }
  return grouped;
}

export function storyboardNeedsRecovery(world: WorldConfig | null | undefined): boolean {
  const frames = world?.worldStoryboard ?? [];
  if (frames.length === 0) return true;
  return frames.every((f) => !f.sceneUrl && !f.videoUrl);
}

export function mergeRecoveredStoryboard(
  world: WorldConfig | null | undefined,
  recovered: WorldStoryboardFrame[]
): WorldConfig | null {
  if (!recovered.length) return world ?? null;
  const existing = world?.worldStoryboard ?? [];
  const len = Math.max(existing.length, recovered.length);
  const frames: WorldStoryboardFrame[] = [];
  for (let i = 0; i < len; i += 1) {
    const cur = existing[i];
    const rec = recovered[i];
    frames.push({
      sceneUrl: cur?.sceneUrl || rec?.sceneUrl || null,
      videoUrl: cur?.videoUrl || rec?.videoUrl || null,
      energy: cur?.energy ?? rec?.energy,
    });
  }
  return normalizeWorldConfigInput({
    ...(world ?? {}),
    worldStoryboard: frames,
  });
}

export async function recoverStoryboardForEvent(opts: {
  eventId: string;
  slug: string;
  worldConfig: WorldConfig | null | undefined;
}): Promise<{ worldConfig: WorldConfig | null; recovered: boolean; prefixes: string[] }> {
  const files = await listStoryboardFiles();
  const grouped = groupStoryboardFiles(files);
  const prefixes = [opts.slug, opts.eventId].map((p) => p.trim().toLowerCase()).filter(Boolean);
  let recoveredFrames: WorldStoryboardFrame[] = [];
  for (const prefix of prefixes) {
    const frames = grouped.get(prefix);
    if (frames?.length) {
      recoveredFrames = frames;
      break;
    }
  }
  if (!recoveredFrames.length) {
    return { worldConfig: opts.worldConfig ?? null, recovered: false, prefixes };
  }
  const merged = mergeRecoveredStoryboard(opts.worldConfig, recoveredFrames);
  return { worldConfig: merged, recovered: true, prefixes };
}

export type StoryboardOrphan = {
  prefix: string;
  frameCount: number;
};

export async function listStoryboardOrphans(knownSlugsAndIds: string[]): Promise<StoryboardOrphan[]> {
  const files = await listStoryboardFiles();
  const grouped = groupStoryboardFiles(files);
  const known = new Set(knownSlugsAndIds.map((s) => s.trim().toLowerCase()).filter(Boolean));
  const orphans: StoryboardOrphan[] = [];
  for (const [prefix, frames] of Array.from(grouped.entries())) {
    if (known.has(prefix)) continue;
    if (prefix === "draft") continue;
    orphans.push({ prefix, frameCount: frames.length });
  }
  return orphans.sort((a, b) => b.frameCount - a.frameCount);
}

/** One historical still+loop pair for a frame slot (includes superseded regenerations). */
export type StoryboardVersion = {
  prefix: string;
  frameIndex: number;
  sceneUrl: string | null;
  videoUrl: string | null;
  createdAt: string | null;
  sceneFilename: string | null;
  videoFilename: string | null;
};

/**
 * Every persisted scene/video for the given event prefixes — not just the newest per slot.
 * Used to restore frames that Generate used to replace in worldConfig.
 */
export function listStoryboardVersions(
  files: StorageFile[],
  prefixes: string[]
): StoryboardVersion[] {
  const want = new Set(prefixes.map((p) => p.trim().toLowerCase()).filter(Boolean));
  if (!want.size) return [];

  type Named = { name: string; created?: string; prefix: string; index: number };
  const scenes: Named[] = [];
  const videos: Named[] = [];

  for (const file of files) {
    const scene = SCENE_RE.exec(file.name);
    if (scene) {
      const prefix = scene[1].toLowerCase();
      if (!want.has(prefix)) continue;
      scenes.push({
        name: file.name,
        created: file.created_at,
        prefix,
        index: Number(scene[2]) - 1,
      });
      continue;
    }
    const video = VIDEO_RE.exec(file.name);
    if (video) {
      const prefix = video[1].toLowerCase();
      if (!want.has(prefix)) continue;
      videos.push({
        name: file.name,
        created: file.created_at,
        prefix,
        index: Number(video[2]) - 1,
      });
    }
  }

  const bySlot = new Map<string, { scenes: Named[]; videos: Named[] }>();
  function slot(prefix: string, index: number) {
    const key = `${prefix}::${index}`;
    let entry = bySlot.get(key);
    if (!entry) {
      entry = { scenes: [], videos: [] };
      bySlot.set(key, entry);
    }
    return entry;
  }
  for (const s of scenes) slot(s.prefix, s.index).scenes.push(s);
  for (const v of videos) slot(v.prefix, v.index).videos.push(v);

  const newerFirst = (a: Named, b: Named) => {
    const ac = a.created ?? "";
    const bc = b.created ?? "";
    if (ac !== bc) return bc.localeCompare(ac);
    return b.name.localeCompare(a.name);
  };

  const out: StoryboardVersion[] = [];
  for (const [key, entry] of Array.from(bySlot.entries())) {
    const [prefix, idxStr] = key.split("::");
    const frameIndex = Number(idxStr);
    entry.scenes.sort(newerFirst);
    entry.videos.sort(newerFirst);
    const n = Math.max(entry.scenes.length, entry.videos.length);
    for (let i = 0; i < n; i += 1) {
      const scene = entry.scenes[i];
      const video = entry.videos[i];
      out.push({
        prefix,
        frameIndex,
        sceneUrl: scene ? publicStoryboardUrl(scene.name) : null,
        videoUrl: video ? publicStoryboardUrl(video.name) : null,
        createdAt: scene?.created ?? video?.created ?? null,
        sceneFilename: scene?.name ?? null,
        videoFilename: video?.name ?? null,
      });
    }
  }

  return out.sort((a, b) => {
    const ac = a.createdAt ?? "";
    const bc = b.createdAt ?? "";
    if (ac !== bc) return bc.localeCompare(ac);
    if (a.frameIndex !== b.frameIndex) return a.frameIndex - b.frameIndex;
    return 0;
  });
}

export async function listStoryboardVersionsForEvent(opts: {
  eventId: string;
  slug?: string | null;
}): Promise<StoryboardVersion[]> {
  const files = await listStoryboardFiles();
  const prefixes = [opts.slug, opts.eventId]
    .map((p) => (typeof p === "string" ? p.trim().toLowerCase() : ""))
    .filter(Boolean);
  // de-dupe while preserving order
  const seen = new Set<string>();
  const unique = prefixes.filter((p) => (seen.has(p) ? false : (seen.add(p), true)));
  return listStoryboardVersions(files, unique);
}
