import { supabaseAdmin } from "@/lib/supabase-server";

export const AGENT_MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "agent-media";

export const MAX_AGENT_AUDIO_BYTES = 12 * 1024 * 1024;
export const MAX_AGENT_VIDEO_BYTES = 25 * 1024 * 1024;

let bucketChecked = false;

export async function ensureAgentMediaBucket(): Promise<void> {
  if (!supabaseAdmin || bucketChecked) return;
  bucketChecked = true;
  const { data: existing, error } = await supabaseAdmin.storage.listBuckets();
  if (error) return;
  if (!existing?.some((b) => b.name === AGENT_MEDIA_BUCKET)) {
    await supabaseAdmin.storage.createBucket(AGENT_MEDIA_BUCKET, { public: true });
  }
}

export function sanitizeConversationKey(conversationId: string): string {
  return conversationId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

export function extForAgentMedia(contentType: string, kind: "audio" | "video"): string {
  const ct = contentType.toLowerCase();
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

export function newTurnMediaPath(conversationId: string, kind: "audio" | "video", ext: string): string {
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
