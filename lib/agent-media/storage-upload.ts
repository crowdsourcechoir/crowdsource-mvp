import { supabaseAdmin } from "@/lib/supabase-server";

export const AGENT_MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "agent-media";

export const MAX_AGENT_AUDIO_BYTES = 12 * 1024 * 1024;
export const MAX_AGENT_VIDEO_BYTES = 25 * 1024 * 1024;
export const MAX_AGENT_PHOTO_BYTES = 8 * 1024 * 1024;

export type AgentMediaKind = "audio" | "video" | "photo";

let bucketChecked = false;

export async function ensureAgentMediaBucket(): Promise<void> {
  if (!supabaseAdmin || bucketChecked) return;
  bucketChecked = true;
  const { data: existing, error } = await supabaseAdmin.storage.listBuckets();
  if (error) return;
  const bucket = existing?.find((b) => b.name === AGENT_MEDIA_BUCKET);
  if (!bucket) {
    await supabaseAdmin.storage.createBucket(AGENT_MEDIA_BUCKET, { public: true });
    return;
  }
  // Older buckets may be private — public URLs then 403 in <img>/<video>.
  if (!bucket.public) {
    await supabaseAdmin.storage.updateBucket(AGENT_MEDIA_BUCKET, { public: true });
  }
}

export function sanitizeConversationKey(conversationId: string): string {
  return conversationId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

export function extForAgentMedia(contentType: string, kind: AgentMediaKind): string {
  const ct = contentType.toLowerCase();
  if (kind === "photo") {
    if (ct.includes("png")) return "png";
    if (ct.includes("webp")) return "webp";
    return "jpg";
  }
  if (kind === "audio") {
    if (ct.includes("mpeg")) return "mp3";
    if (ct.includes("ogg")) return "ogg";
    if (ct.includes("mp4") || ct.includes("aac")) return "m4a";
    return "wav";
  }
  if (ct.includes("mp4")) return "mp4";
  if (ct.includes("webm")) return "webm";
  return "webm";
}

export function newTurnMediaPath(conversationId: string, kind: AgentMediaKind, ext: string): string {
  const key = sanitizeConversationKey(conversationId);
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `conversations/${key}/${kind}-${stamp}-${rand}.${ext}`;
}

export function agentMediaPublicUrl(path: string): string {
  if (!supabaseAdmin) return "";
  const { data } = supabaseAdmin.storage.from(AGENT_MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function createAgentMediaSignedUpload(path: string): Promise<{
  signedUrl: string;
  token: string;
  path: string;
  publicUrl: string;
}> {
  if (!supabaseAdmin) throw new Error("Storage not configured.");
  await ensureAgentMediaBucket();
  const { data, error } = await supabaseAdmin.storage
    .from(AGENT_MEDIA_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error || !data) {
    throw new Error(error?.message || "Could not create signed upload URL.");
  }
  return {
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    publicUrl: agentMediaPublicUrl(data.path),
  };
}

export function isPathForConversation(conversationId: string, path: string): boolean {
  const key = sanitizeConversationKey(conversationId);
  return path.startsWith(`conversations/${key}/`);
}

export async function verifyAgentMediaObject(path: string): Promise<boolean> {
  if (!supabaseAdmin || !path.trim()) return false;
  const segments = path.split("/");
  const name = segments.pop();
  const folder = segments.join("/");
  if (!name || !folder.startsWith("conversations/")) return false;
  const { data, error } = await supabaseAdmin.storage.from(AGENT_MEDIA_BUCKET).list(folder, {
    limit: 100,
  });
  if (error || !data?.length) return false;
  return data.some((f) => f.name === name);
}

/** Extract storage object path from a public URL, or return a bare path as-is. */
export function agentMediaPathFromUrlOrPath(urlOrPath: string): string | null {
  const raw = urlOrPath.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) {
    const path = raw.replace(/^\/+/, "");
    return path.startsWith("conversations/") ? path : null;
  }
  try {
    const u = new URL(raw);
    const publicMarker = `/storage/v1/object/public/${AGENT_MEDIA_BUCKET}/`;
    const signMarker = `/storage/v1/object/sign/${AGENT_MEDIA_BUCKET}/`;
    const authMarker = `/storage/v1/object/authenticated/${AGENT_MEDIA_BUCKET}/`;
    for (const marker of [publicMarker, signMarker, authMarker]) {
      const idx = u.pathname.indexOf(marker);
      if (idx >= 0) {
        const path = decodeURIComponent(u.pathname.slice(idx + marker.length));
        return path.startsWith("conversations/") ? path : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Same-origin proxy URL so Composer never depends on a public Storage CDN. */
export function proxiedAgentMediaUrl(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath?.trim()) return null;
  const path = agentMediaPathFromUrlOrPath(urlOrPath);
  if (!path) return urlOrPath.trim();
  return `/api/agent/media?path=${encodeURIComponent(path)}`;
}

/** Download via service role (works for private or public buckets). */
export async function downloadAgentMediaObject(
  path: string
): Promise<{ buffer: Buffer; contentType: string | null } | null> {
  if (!supabaseAdmin || !path.trim()) return null;
  if (!path.startsWith("conversations/") || path.includes("..")) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(AGENT_MEDIA_BUCKET)
    .download(path.trim());
  if (error || !data) {
    console.error("agent media download failed:", path, error?.message);
    return null;
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  if (buffer.length === 0) return null;
  return { buffer, contentType: data.type || null };
}

export function guessAgentMediaContentType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".wav")) return "audio/wav";
  return "application/octet-stream";
}
