export type LibraryVideo = {
  src: string;
  label: string;
};

type VideoSlide = {
  video?: string | null;
  videoLabel?: string | null;
  imageAlt?: string | null;
};

type VideoPitch = {
  name?: string | null;
  slides?: VideoSlide[] | null;
};

/**
 * The one upload made before filenames were kept.
 * Storage only has promise-1794529293962.mp4.
 */
const REMEMBERED_TITLES: Array<[string, string]> = [
  ["promise-1794529293962.mp4", "Your love keeps lifting me higher"],
];

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

/** Title from an uploaded filename, without the extension. */
export function videoTitleFromFilename(name: string): string {
  const base = name.replace(/^.*[/\\]/, "").replace(/\.[a-z0-9]{1,5}$/i, "");
  return base.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

export function rememberedVideoTitle(src: string): string | null {
  const path = src.split("?")[0] ?? src;
  for (const [file, title] of REMEMBERED_TITLES) {
    if (path.endsWith(`/${file}`) || path.endsWith(file)) return title;
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
      const saved = slide.videoLabel?.trim() || "";
      videos.push({
        src,
        label: saved || rememberedVideoTitle(src) || name || "Uploaded video",
      });
    }
  }
  return videos;
}
