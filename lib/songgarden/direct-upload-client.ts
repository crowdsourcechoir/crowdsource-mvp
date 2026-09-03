import { clipStoragePublicUrl } from "@/lib/songgarden/storage-upload";

export type DirectUploadSlot = {
  signedUrl: string;
  token: string;
  path: string;
  publicUrl: string;
};

export type PrepareClipUploadResponse = {
  playable: DirectUploadSlot;
  original: DirectUploadSlot | null;
  maxBytes: number;
};

/** PUT blob to Supabase signed upload URL. */
export async function putToSignedUpload(
  signedUrl: string,
  blob: Blob,
  contentType: string
): Promise<void> {
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: blob,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Upload failed (${res.status})`);
  }
}

export async function prepareClipUpload(args: {
  eventId: string;
  category: string;
  deviceId: string;
  sessionToken: string;
  playableSize: number;
  originalSize: number;
  contentType: string;
  ext: string;
}): Promise<PrepareClipUploadResponse> {
  const res = await fetch("/api/songgarden/upload/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Could not prepare upload");
  }
  return res.json() as Promise<PrepareClipUploadResponse>;
}

export async function confirmClipUpload(body: Record<string, unknown>) {
  const res = await fetch("/api/songgarden/upload/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const err = errBody as { error?: string; code?: string; retryAfterMs?: number };
    const message = err.error ?? "Failed to confirm upload";
    const e = new Error(message) as Error & { code?: string; retryAfterMs?: number };
    e.code = err.code;
    e.retryAfterMs = err.retryAfterMs;
    throw e;
  }
  return res.json();
}

export { clipStoragePublicUrl };
