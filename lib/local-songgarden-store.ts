import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { SonggardenCategoryId, SonggardenClip } from "@/lib/songgarden/types";
import type { SonggardenSubmissionRecord } from "@/lib/songgarden/rate-limit";

const ROOT = path.join(process.cwd(), ".data", "songgarden");

function eventDir(eventId: string): string {
  return path.join(ROOT, eventId);
}

function manifestPath(eventId: string): string {
  return path.join(eventDir(eventId), "clips.json");
}

function audioPath(eventId: string, clipId: string, ext: string): string {
  return path.join(eventDir(eventId), "audio", `${clipId}.${ext}`);
}

async function ensureEventDir(eventId: string): Promise<void> {
  await fs.mkdir(path.join(eventDir(eventId), "audio"), { recursive: true });
}

function normalizeClip(raw: Record<string, unknown>): SonggardenClip {
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    eventId: typeof raw.eventId === "string" ? raw.eventId : "",
    contributorName: raw.contributorName != null ? String(raw.contributorName) : null,
    label: raw.label != null ? String(raw.label) : null,
    category: raw.category as SonggardenCategoryId,
    filename: typeof raw.filename === "string" ? raw.filename : "sound.wav",
    mimeType: typeof raw.mimeType === "string" ? raw.mimeType : "audio/wav",
    durationMs: raw.durationMs != null ? Number(raw.durationMs) : null,
    deviceId: typeof raw.deviceId === "string" ? raw.deviceId : "",
    sessionToken: raw.sessionToken != null ? String(raw.sessionToken) : null,
    submittedAt: typeof raw.submittedAt === "string" ? raw.submittedAt : new Date().toISOString(),
  };
}

async function readManifest(eventId: string): Promise<SonggardenClip[]> {
  try {
    const raw = await fs.readFile(manifestPath(eventId), "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    return Array.isArray(parsed) ? parsed.map(normalizeClip) : [];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    throw err;
  }
}

async function writeManifest(eventId: string, clips: SonggardenClip[]): Promise<void> {
  await ensureEventDir(eventId);
  await fs.writeFile(manifestPath(eventId), JSON.stringify(clips, null, 2), { mode: 0o600 });
}

export async function localSonggardenList(
  eventId: string,
  since?: string | null
): Promise<SonggardenClip[]> {
  const clips = await readManifest(eventId);
  const sorted = [...clips].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
  if (!since) return sorted;
  const sinceMs = new Date(since).getTime();
  if (Number.isNaN(sinceMs)) return sorted;
  return sorted.filter((c) => new Date(c.submittedAt).getTime() > sinceMs);
}

export async function localSonggardenSubmissionRecords(eventId: string): Promise<SonggardenSubmissionRecord[]> {
  const clips = await readManifest(eventId);
  return clips
    .map((c) => ({
      submittedAt: c.submittedAt,
      deviceId: c.deviceId,
      sessionToken: c.sessionToken,
      ipHash: null,
    }))
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

export async function localSonggardenActivity(
  eventId: string,
  sinceIso: string
): Promise<{ total: number; recent: number }> {
  const clips = await readManifest(eventId);
  const sinceMs = new Date(sinceIso).getTime();
  const recent = clips.filter((c) => new Date(c.submittedAt).getTime() > sinceMs).length;
  return { total: clips.length, recent };
}

export async function localSonggardenGetClip(
  eventId: string,
  clipId: string
): Promise<SonggardenClip | null> {
  const clips = await readManifest(eventId);
  return clips.find((c) => c.id === clipId) ?? null;
}

export async function localSonggardenAddClip(args: {
  eventId: string;
  contributorName?: string | null;
  label?: string | null;
  category: SonggardenCategoryId;
  filename: string;
  mimeType: string;
  durationMs?: number | null;
  deviceId: string;
  sessionToken?: string | null;
  audioBuffer: Buffer;
  ext: string;
}): Promise<SonggardenClip> {
  await ensureEventDir(args.eventId);
  const id = randomUUID();
  const clip: SonggardenClip = {
    id,
    eventId: args.eventId,
    contributorName: args.contributorName ?? null,
    label: args.label ?? null,
    category: args.category,
    filename: args.filename,
    mimeType: args.mimeType,
    durationMs: args.durationMs ?? null,
    deviceId: args.deviceId,
    sessionToken: args.sessionToken ?? null,
    submittedAt: new Date().toISOString(),
  };
  await fs.writeFile(audioPath(args.eventId, id, args.ext), args.audioBuffer);
  const clips = await readManifest(args.eventId);
  clips.push(clip);
  await writeManifest(args.eventId, clips);
  return clip;
}

export async function localSonggardenReadAudio(
  eventId: string,
  clipId: string
): Promise<{ buffer: Buffer; clip: SonggardenClip } | null> {
  const clip = await localSonggardenGetClip(eventId, clipId);
  if (!clip) return null;
  const ext = clip.filename.split(".").pop() || "wav";
  try {
    const buffer = await fs.readFile(audioPath(eventId, clipId, ext));
    return { buffer, clip };
  } catch {
    return null;
  }
}

export async function localSonggardenWipeEvent(eventId: string): Promise<number> {
  const clips = await readManifest(eventId);
  const count = clips.length;
  try {
    await fs.rm(eventDir(eventId), { recursive: true, force: true });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") throw err;
  }
  return count;
}
