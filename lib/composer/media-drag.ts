/**
 * Filename + MIME for dragging a Composer photo or video into Finder / a DAW.
 * Text answers are not drag sources.
 */

export type MediaDragMeta = {
  mime: string;
  filename: string;
  kind: "photo" | "video";
};

function extensionOf(url: string): string {
  try {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(/\.([a-z0-9]{2,5})(?:\?|$)/i);
    return match?.[1]?.toLowerCase() ?? "";
  } catch {
    const match = url.match(/\.([a-z0-9]{2,5})(?:\?|$)/i);
    return match?.[1]?.toLowerCase() ?? "";
  }
}

export function isPhotoMediaUrl(url: string): boolean {
  if (/^data:image\//i.test(url)) return true;
  const ext = extensionOf(url);
  if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp" || ext === "gif") {
    return true;
  }
  try {
    const decoded = decodeURIComponent(url);
    return /\/photo-/i.test(decoded) || /(^|[/?&=])photo-/i.test(decoded);
  } catch {
    return /\/photo-/i.test(url) || /photo-/i.test(url);
  }
}

function safeName(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned || "contribution";
}

export function mediaDragMeta(url: string, participantName: string): MediaDragMeta {
  const photo = isPhotoMediaUrl(url);
  const ext = extensionOf(url);
  const kind: MediaDragMeta["kind"] = photo ? "photo" : "video";
  const fileExt = photo
    ? ext === "png" || ext === "webp" || ext === "gif"
      ? ext
      : "jpg"
    : ext === "mp4" || ext === "webm"
      ? ext
      : "webm";
  const mime = photo
    ? fileExt === "png"
      ? "image/png"
      : fileExt === "webp"
        ? "image/webp"
        : fileExt === "gif"
          ? "image/gif"
          : "image/jpeg"
    : fileExt === "mp4"
      ? "video/mp4"
      : "video/webm";
  return {
    mime,
    filename: `${safeName(participantName)}-${kind}.${fileExt}`,
    kind,
  };
}
