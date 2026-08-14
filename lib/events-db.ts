import type { SongGardenConfig } from "@/lib/songgarden/config";
import type { WorldConfig, WorldStoryboardFrame } from "@/lib/song-garden-v2/world-config";
import { normalizeWorldConfigInput } from "@/lib/song-garden-v2/world-config";
import { supabaseAdmin } from "@/lib/supabase-server";

const BUCKET = process.env.SONG_GARDEN_MEDIA_BUCKET || "song-garden-world-media";

/**
 * List/admin payloads must stay small. Selecting * pulled multi-MB data-URI
 * heroes and world JSON and tripped Postgres `statement timeout`.
 */
export const EVENT_LIST_SELECT =
  "id,slug,title,description,date,time,venue,address,prompt,hero_image_mode,landing_headline,landing_copy,cta_text,anthem_completion_message,allow_audio_video_prompt,agent_theme_id";

/** Detail fetch — omit hero_image (data-URI bombs) but keep world_config for edit/journey. */
export const EVENT_DETAIL_SELECT =
  "id,slug,title,description,date,time,venue,address,prompt,hero_image_mode,landing_headline,landing_copy,cta_text,anthem_completion_message,allow_audio_video_prompt,agent_theme_id,agent_brief,song_garden_config,world_config";

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
    heroImage: typeof row.hero_image === "string" && !row.hero_image.startsWith("data:") ? row.hero_image : "",
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

type StorageFile = { name: string; created_at?: string };

async function listStoryboardFiles(): Promise<StorageFile[]> {
  if (!supabaseAdmin) return [];
  const out: StorageFile[] = [];
  const pageSize = 100;
  for (let offset = 0; offset < 2000; offset += pageSize) {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).list("storyboards", {
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

function publicStoryboardUrl(filename: string): string {
  if (!supabaseAdmin) return `storyboards/${filename}`;
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(`storyboards/${filename}`);
  return data.publicUrl;
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
