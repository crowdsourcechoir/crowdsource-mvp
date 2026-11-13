export type LibraryVideo = {
  src: string;
  label: string;
};

type VideoSlide = {
  video?: string | null;
  imageAlt?: string | null;
};

type VideoPitch = {
  name?: string | null;
  slides?: VideoSlide[] | null;
};

function safeVideoUrl(value: string): string | null {
  const url = value.trim();
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("..")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return url;
  } catch {
    return null;
  }
  return null;
}

/**
 * Videos already uploaded onto pitch slides, one entry per file.
 * The photo library stays the stills. These are the looping backgrounds.
 */
export function uploadedLibraryVideos(pitches: VideoPitch[]): LibraryVideo[] {
  const seen = new Set<string>();
  const videos: LibraryVideo[] = [];
  for (const pitch of pitches) {
    const name = pitch.name?.trim() || "";
    for (const slide of pitch.slides ?? []) {
      const src = safeVideoUrl(slide.video ?? "");
      if (!src || seen.has(src)) continue;
      seen.add(src);
      const alt = slide.imageAlt?.trim() || "";
      videos.push({ src, label: name || alt || "Uploaded video" });
    }
  }
  return videos;
}
