import { putToSignedUpload } from "@/lib/songgarden/direct-upload-client";
import type { AgentMediaKind } from "@/lib/agent-media/storage-upload";

export type TurnMediaUploadResult = {
  storagePath: string;
  publicUrl: string;
};

function extFromBlob(blob: Blob, kind: AgentMediaKind): string {
  const type = blob.type.toLowerCase();
  if (kind === "photo") {
    if (type.includes("png")) return "png";
    if (type.includes("webp")) return "webp";
    return "jpg";
  }
  if (kind === "video") {
    if (type.includes("mp4")) return "mp4";
    return "webm";
  }
  if (type.includes("mpeg")) return "mp3";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mp4")) return "m4a";
  return "wav";
}

function defaultContentType(kind: AgentMediaKind): string {
  if (kind === "photo") return "image/jpeg";
  if (kind === "video") return "video/webm";
  return "audio/wav";
}

/** Direct-to-storage for journey interview audio/video/photo (bypasses Vercel body limit). */
export async function uploadTurnMedia(
  conversationId: string,
  kind: AgentMediaKind,
  blob: Blob
): Promise<TurnMediaUploadResult> {
  const contentType = blob.type || defaultContentType(kind);
  const ext = extFromBlob(blob, kind);

  const res = await fetch(`/api/agent/conversations/${encodeURIComponent(conversationId)}/media/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind,
      size: blob.size,
      contentType,
      ext,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Could not prepare media upload");
  }

  const prepared = (await res.json()) as {
    upload: { signedUrl: string; path: string; publicUrl: string };
  };

  await putToSignedUpload(prepared.upload.signedUrl, blob, contentType);

  return {
    storagePath: prepared.upload.path,
    publicUrl: prepared.upload.publicUrl,
  };
}
