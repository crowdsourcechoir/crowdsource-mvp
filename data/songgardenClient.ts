import type { SonggardenCategoryId, SonggardenClip } from "@/lib/songgarden/types";

export type { SonggardenCategoryId, SonggardenClip };

const DEVICE_ID_KEY = "csc_songgarden_device_id";
const SESSION_PREFIX = "csc_songgarden_session_";
const ACCESS_PREFIX = "csc_songgarden_access_";

export function songgardenAudioUrl(
  eventId: string,
  clipId: string,
  cacheKey?: string | null,
  opts?: { original?: boolean }
): string {
  const params = new URLSearchParams({ eventId });
  if (cacheKey) {
    const version = Number.isFinite(Date.parse(cacheKey))
      ? String(Date.parse(cacheKey))
      : cacheKey;
    params.set("v", version);
  }
  if (opts?.original) params.set("original", "1");
  return `/api/songgarden/${clipId}/audio?${params.toString()}`;
}

export function getOrCreateSonggardenDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getOrCreateSonggardenSessionToken(eventId: string): string {
  if (typeof window === "undefined") return "";
  const key = `${SESSION_PREFIX}${eventId}`;
  let token = localStorage.getItem(key);
  if (!token) {
    token = `sg_sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(key, token);
  }
  return token;
}

export async function listSonggardenClips(
  eventId: string,
  since?: string | null
): Promise<SonggardenClip[]> {
  const params = new URLSearchParams({ eventId });
  if (since) params.set("since", since);
  const res = await fetch(`/api/songgarden?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to load Songgarden clips");
  }
  const data = (await res.json()) as { clips: SonggardenClip[] };
  return data.clips ?? [];
}

export type SonggardenSubmitResult = {
  clip: SonggardenClip;
  gardenCelebrationLine?: string | null;
  gardenWorldVersion?: number | null;
};

export async function submitSonggardenClip(args: {
  eventId: string;
  category: SonggardenCategoryId;
  audio: Blob;
  filename: string;
  contributorName?: string | null;
  label?: string | null;
  durationMs?: number | null;
  /** Untrimmed WAV — stored for audition / restore. */
  originalAudio?: Blob | null;
  trimLeadMs?: number | null;
  trimTrailMs?: number | null;
  trimStatus?: "none" | "trimmed" | "skipped";
}): Promise<SonggardenSubmitResult> {
  const form = new FormData();
  form.set("eventId", args.eventId);
  form.set("category", args.category);
  form.set("deviceId", getOrCreateSonggardenDeviceId());
  form.set("sessionToken", getOrCreateSonggardenSessionToken(args.eventId));
  form.set("audio", args.audio, args.filename);
  if (args.originalAudio) {
    form.set("audioOriginal", args.originalAudio, args.filename.replace(/\.wav$/i, ".original.wav"));
  }
  if (args.contributorName) form.set("contributorName", args.contributorName);
  if (args.label) form.set("label", args.label);
  if (args.durationMs != null) form.set("durationMs", String(args.durationMs));
  if (args.trimLeadMs != null) form.set("trimLeadMs", String(args.trimLeadMs));
  if (args.trimTrailMs != null) form.set("trimTrailMs", String(args.trimTrailMs));
  if (args.trimStatus) form.set("trimStatus", args.trimStatus);

  const res = await fetch("/api/songgarden", { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to submit sound");
  }
  const data = (await res.json()) as SonggardenSubmitResult;
  return data;
}

export async function restoreSonggardenOriginal(
  eventId: string,
  clipId: string
): Promise<SonggardenClip> {
  const res = await fetch(`/api/songgarden/${clipId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, action: "restore_original" }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to restore original");
  }
  const data = (await res.json()) as { clip: SonggardenClip };
  return data.clip;
}

export async function fetchClipFile(
  eventId: string,
  clip: SonggardenClip,
  opts?: { original?: boolean }
): Promise<File> {
  const res = await fetch(
    songgardenAudioUrl(eventId, clip.id, clip.submittedAt, { original: opts?.original }),
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(opts?.original ? "Failed to fetch original audio" : "Failed to fetch audio");
  const blob = await res.blob();
  const name = opts?.original
    ? clip.filename.replace(/(\.[^.]+)?$/, ".original$1")
    : clip.filename;
  return new File([blob], name, { type: clip.mimeType || blob.type || "audio/wav" });
}

export function grantSonggardenAccess(eventId: string): string {
  const token = `sg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  if (typeof window !== "undefined") {
    localStorage.setItem(`${ACCESS_PREFIX}${eventId}`, token);
    getOrCreateSonggardenSessionToken(eventId);
  }
  return token;
}

export function hasSonggardenAccess(eventId: string): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(`${ACCESS_PREFIX}${eventId}`);
}

export function getSonggardenContributorName(eventId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`${ACCESS_PREFIX}${eventId}_name`);
}

export function setSonggardenContributorName(eventId: string, name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${ACCESS_PREFIX}${eventId}_name`, name.trim());
}
