import { supabaseAdmin } from "@/lib/supabase-server";

export const PARTICIPANT_CLIPS_BUCKET =
  process.env.SONG_GARDEN_MEDIA_BUCKET || "song-garden-world-media";

const CLIPS_FOLDER = "clips";

let bucketChecked = false;

export async function ensureParticipantClipsBucket(): Promise<void> {
  if (!supabaseAdmin || bucketChecked) return;
  bucketChecked = true;
  const { data: existing, error } = await supabaseAdmin.storage.listBuckets();
  if (error) return;
  if (!existing?.some((b) => b.name === PARTICIPANT_CLIPS_BUCKET)) {
    await supabaseAdmin.storage.createBucket(PARTICIPANT_CLIPS_BUCKET, { public: true });
  }
}

export function clipStoragePublicUrl(path: string): string {
  if (!supabaseAdmin) return "";
  const { data } = supabaseAdmin.storage.from(PARTICIPANT_CLIPS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function sanitizeClipStorageKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

/** Unique object key under clips/{eventId}/ */
export function newClipObjectPath(eventId: string, suffix: string, ext: string): string {
  const eventKey = sanitizeClipStorageKey(eventId);
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${CLIPS_FOLDER}/${eventKey}/${stamp}-${rand}-${suffix}.${ext}`;
}

export async function createClipSignedUpload(path: string): Promise<{
  signedUrl: string;
  token: string;
  path: string;
  publicUrl: string;
}> {
  if (!supabaseAdmin) {
    throw new Error("Storage not configured.");
  }
  await ensureParticipantClipsBucket();
  const { data, error } = await supabaseAdmin.storage
    .from(PARTICIPANT_CLIPS_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error || !data) {
    throw new Error(error?.message || "Could not create signed upload URL.");
  }
  return {
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    publicUrl: clipStoragePublicUrl(data.path),
  };
}

/** Verify uploaded object exists in the clips folder. */
export async function verifyClipObject(path: string, _maxBytes: number): Promise<boolean> {
  if (!supabaseAdmin || !path.trim()) return false;
  const segments = path.split("/");
  const name = segments.pop();
  const folder = segments.join("/");
  if (!name || !folder.startsWith("clips/")) return false;
  const { data, error } = await supabaseAdmin.storage.from(PARTICIPANT_CLIPS_BUCKET).list(folder, {
    limit: 100,
  });
  if (error || !data?.length) return false;
  return data.some((f) => f.name === name);
}
