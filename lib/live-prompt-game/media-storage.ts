import {
  PARTICIPANT_CLIPS_BUCKET,
  clipStoragePublicUrl,
  createClipSignedUpload,
  ensureParticipantClipsBucket,
  sanitizeClipStorageKey,
  verifyClipObject,
} from "@/lib/songgarden/storage-upload";

export { clipStoragePublicUrl, verifyClipObject, PARTICIPANT_CLIPS_BUCKET };

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_SOUND_BYTES = 12 * 1024 * 1024;

export function maxBytesForMediaType(mediaType: "photo" | "sound" | "video"): number {
  if (mediaType === "photo") return MAX_PHOTO_BYTES;
  return MAX_SOUND_BYTES;
}

/** Object key under clips/{eventOrSession}/live/{sessionId}/ */
export function newLiveMediaObjectPath(args: {
  sessionId: string;
  eventId: string | null;
  mediaType: "photo" | "sound" | "video";
  ext: string;
}): string {
  const root = sanitizeClipStorageKey(args.eventId || args.sessionId);
  const sessionKey = sanitizeClipStorageKey(args.sessionId);
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const ext = args.ext.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase() || "bin";
  return `clips/${root}/live/${sessionKey}/${stamp}-${rand}-${args.mediaType}.${ext}`;
}

export async function createLiveMediaSignedUpload(path: string) {
  await ensureParticipantClipsBucket();
  return createClipSignedUpload(path);
}

export function liveSessionGardenLabel(args: {
  sessionSlug: string;
  mediaType: "photo" | "sound" | "video";
}): string {
  const kind = args.mediaType === "photo" ? "selfie" : args.mediaType === "sound" ? "snap" : "video";
  return `Live · ${args.sessionSlug} · ${kind}`;
}
