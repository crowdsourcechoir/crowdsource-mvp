import type { SonggardenClip } from "@/lib/songgarden/types";
import { songgardenCategoryLabel } from "@/lib/songgarden/categories";

/** Build a clean, DAW-friendly `.wav` filename. */
export function wavFilename(clip: SonggardenClip): string {
  const base =
    (clip.label || clip.filename || "clip").replace(/\.[^.]+$/, "").trim() || "clip";
  const who = clip.contributorName ? `${clip.contributorName}-` : "";
  return `${who}${base}`.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_") + ".wav";
}

/** Safe folder / path segment for zip entries. */
export function soundPackPathSegment(raw: string, fallback = "untitled"): string {
  const cleaned = raw
    .trim()
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+|[._]+$/g, "");
  return cleaned || fallback;
}

export type SoundPackManifestClip = {
  id: string;
  pathByPerson: string;
  pathByCategory: string;
  filename: string;
  contributorName: string | null;
  label: string | null;
  category: string;
  categoryLabel: string;
  durationMs: number | null;
  submittedAt: string;
};

export type SoundPackManifest = {
  version: 1;
  eventId: string;
  eventSlug: string;
  exportedAt: string;
  clipCount: number;
  notes: string[];
  clips: SoundPackManifestClip[];
};

export type SoundPackEntry = {
  path: string;
  clip: SonggardenClip;
};

/**
 * Build zip paths for an event sound pack.
 * Dual layout: by-person/{name}/{category}/file.wav and by-category/{category}/{name}-file.wav
 */
export function buildSoundPackLayout(args: {
  eventId: string;
  eventSlug: string;
  clips: SonggardenClip[];
}): {
  entries: SoundPackEntry[];
  manifest: SoundPackManifest;
} {
  const usedPersonPaths = new Set<string>();
  const usedCategoryPaths = new Set<string>();
  const entries: SoundPackEntry[] = [];
  const manifestClips: SoundPackManifestClip[] = [];

  function uniquePath(set: Set<string>, path: string): string {
    if (!set.has(path)) {
      set.add(path);
      return path;
    }
    const dot = path.lastIndexOf(".");
    const stem = dot > 0 ? path.slice(0, dot) : path;
    const ext = dot > 0 ? path.slice(dot) : "";
    let n = 2;
    while (set.has(`${stem}_${n}${ext}`)) n += 1;
    const next = `${stem}_${n}${ext}`;
    set.add(next);
    return next;
  }

  const sorted = [...args.clips].sort((a, b) => {
    const an = (a.contributorName || "Anonymous").localeCompare(b.contributorName || "Anonymous");
    if (an !== 0) return an;
    const ac = a.category.localeCompare(b.category);
    if (ac !== 0) return ac;
    return (a.submittedAt || "").localeCompare(b.submittedAt || "");
  });

  for (const clip of sorted) {
    const person = soundPackPathSegment(clip.contributorName || "Anonymous", "Anonymous");
    const category = soundPackPathSegment(clip.category, "other");
    const file = soundPackPathSegment(wavFilename(clip).replace(/\.wav$/i, ""), "clip") + ".wav";

    const pathByPerson = uniquePath(
      usedPersonPaths,
      `by-person/${person}/${category}/${file}`
    );
    const pathByCategory = uniquePath(
      usedCategoryPaths,
      `by-category/${category}/${person}-${file}`
    );

    entries.push({ path: pathByPerson, clip });
    entries.push({ path: pathByCategory, clip });

    manifestClips.push({
      id: clip.id,
      pathByPerson,
      pathByCategory,
      filename: file,
      contributorName: clip.contributorName,
      label: clip.label,
      category: clip.category,
      categoryLabel: songgardenCategoryLabel(clip.category),
      durationMs: clip.durationMs,
      submittedAt: clip.submittedAt,
    });
  }

  return {
    entries,
    manifest: {
      version: 1,
      eventId: args.eventId,
      eventSlug: args.eventSlug,
      exportedAt: new Date().toISOString(),
      clipCount: args.clips.length,
      notes: [
        "WAV samples for Ableton, MPC, and other DAWs.",
        "by-person/ groups pads by contributor; by-category/ groups by sound type.",
        "Each clip appears in both trees (same audio bytes).",
        "Future: silence-trim layer, Ableton Drum Rack, and native MPC program export.",
      ],
      clips: manifestClips,
    },
  };
}

export function soundPackReadme(eventSlug: string, clipCount: number): string {
  return [
    `Song Garden sound pack — ${eventSlug}`,
    ``,
    `${clipCount} clip(s).`,
    ``,
    `Folders`,
    `- by-person/{name}/{category}/…  — browse by contributor`,
    `- by-category/{category}/…       — browse by pad type`,
    ``,
    `Drop WAVs into Ableton Live, MPC, Logic, etc.`,
    `Drag individual pads from the admin UI also works (Chrome/Edge desktop).`,
    ``,
    `manifest.json lists every clip for future Ableton / MPC pack tooling.`,
    ``,
  ].join("\n");
}
