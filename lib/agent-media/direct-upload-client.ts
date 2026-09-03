import { putToSignedUpload } from "@/lib/songgarden/direct-upload-client";

export type TurnMediaUploadResult = {
  storagePath: string;
  publicUrl: string;
};

function extFromBlob(blob: Blob, kind: "audio" | "video"): string {
  const type = blob.type.toLowerCase();
  if (kind === "video") {
    if (type.includes("mp4")) return "mp4";
    return "webm";
  }
  if (type.includes("mpeg")) return "mp3";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mp4")) return "m4a";
  return "wav";
}

/** Direct-to-storage for journey interview audio/video (bypasses Vercel body limit). */
export async function uploadTurnMedia(
  conversationId: string,
  kind: "audio" | "video",
  blob: Blob
): Promise<TurnMediaUploadResult> {
  const contentType = blob.type || (kind === "video" ? "video/webm" : "audio/wav");
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
