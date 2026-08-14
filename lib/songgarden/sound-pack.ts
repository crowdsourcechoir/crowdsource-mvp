import type { SonggardenClip } from "@/lib/songgarden/types";
import { songgardenCategoryLabel } from "@/lib/songgarden/categories";
import { JOURNEY_GARDEN_SLOTS } from "@/lib/songgarden/garden-slots";

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
  pathKit?: string | null;
  filename: string;
  contributorName: string | null;
  label: string | null;
  category: string;
  categoryLabel: string;
  durationMs: number | null;
  submittedAt: string;
  trimStatus: string;
  trimLeadMs: number | null;
  trimTrailMs: number | null;
  hasOriginal: boolean;
};

export type SoundPackManifest = {
  version: 1;
  eventId: string;
  eventSlug: string;
  exportedAt: string;
  clipCount: number;
  kitClipCount: number;
  notes: string[];
  clips: SoundPackManifestClip[];
};

export type SoundPackEntry = {
  path: string;
  clip: SonggardenClip;
};

/**
 * Pick a mixed starter kit: one clip per garden pad label when possible,
 * preferring different contributors so the kit is not a bank of the same voice.
 */
export function pickMixedKitClips(clips: SonggardenClip[]): SonggardenClip[] {
  const preferredLabels = JOURNEY_GARDEN_SLOTS.map((s) => s.label.toUpperCase());
  const byLabel = new Map<string, SonggardenClip[]>();
  for (const clip of clips) {
    const key = (clip.label || "").trim().toUpperCase();
    if (!key) continue;
    const list = byLabel.get(key) ?? [];
    list.push(clip);
    byLabel.set(key, list);
  }

  const usedPeople = new Set<string>();
  const picked: SonggardenClip[] = [];

  for (const label of preferredLabels) {
    const candidates = byLabel.get(label);
    if (!candidates?.length) continue;
    const diverse = candidates.find((c: SonggardenClip) => {
      const who = (c.contributorName || "Anonymous").toLowerCase();
      return !usedPeople.has(who);
    });
    const chosen = diverse ?? candidates[0]!;
    picked.push(chosen);
    usedPeople.add((chosen.contributorName || "Anonymous").toLowerCase());
  }

  for (const [label, candidates] of Array.from(byLabel.entries())) {
    if (preferredLabels.includes(label)) continue;
    if (picked.some((p) => (p.label || "").toUpperCase() === label)) continue;
    const diverse = candidates.find((c: SonggardenClip) => {
      const who = (c.contributorName || "Anonymous").toLowerCase();
      return !usedPeople.has(who);
    });
    const chosen = diverse ?? candidates[0]!;
    picked.push(chosen);
    usedPeople.add((chosen.contributorName || "Anonymous").toLowerCase());
  }

  return picked;
}

/**
 * Build zip paths for an event sound pack.
 * Dual layout: by-person + by-category, plus kit/ableton-starter mixed pads.
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
  const usedKitPaths = new Set<string>();
  const entries: SoundPackEntry[] = [];
  const manifestClips: SoundPackManifestClip[] = [];
  const kitClips = pickMixedKitClips(args.clips);
  const kitIds = new Set(kitClips.map((c) => c.id));

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

  const kitPathById = new Map<string, string>();
  let kitIndex = 1;
  for (const clip of kitClips) {
    const file =
      soundPackPathSegment(
        `${String(kitIndex).padStart(2, "0")}_${wavFilename(clip).replace(/\.wav$/i, "")}`,
        "clip"
      ) + ".wav";
    const pathKit = uniquePath(usedKitPaths, `kit/ableton-starter/${file}`);
    kitPathById.set(clip.id, pathKit);
    entries.push({ path: pathKit, clip });
    kitIndex += 1;
  }

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
      pathKit: kitPathById.get(clip.id) ?? null,
      filename: file,
      contributorName: clip.contributorName,
      label: clip.label,
      category: clip.category,
      categoryLabel: songgardenCategoryLabel(clip.category),
      durationMs: clip.durationMs,
      submittedAt: clip.submittedAt,
      trimStatus: clip.trimStatus ?? "none",
      trimLeadMs: clip.trimLeadMs ?? null,
      trimTrailMs: clip.trimTrailMs ?? null,
      hasOriginal: Boolean(clip.hasOriginal),
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
      kitClipCount: kitIds.size,
      notes: [
        "WAV samples for Ableton Live, Push, MPD Live 2, and other DAWs.",
        "Playable WAVs are silence-trimmed on new uploads (leading + trailing).",
        "Originals stay in the admin clip editor when hasOriginal is true.",
        "by-person/ groups by contributor; by-category/ groups by sound type.",
        "kit/ableton-starter/ is a mixed pad set (one per label when possible, diverse voices).",
        "Each clip appears in person + category trees (same audio bytes).",
        "Future: Ableton Drum Rack (.adg) and native MPC program export.",
      ],
      clips: manifestClips,
    },
  };
}

export function soundPackReadme(eventSlug: string, clipCount: number, kitCount = 0): string {
  return [
    `Song Garden sound pack — ${eventSlug}`,
    ``,
    `${clipCount} clip(s)${kitCount ? ` · ${kitCount} in Ableton starter kit` : ""}.`,
    ``,
    `Folders`,
    `- kit/ableton-starter/           — mixed kit (different pad types / voices)`,
    `- by-person/{name}/{category}/…  — browse by contributor`,
    `- by-category/{category}/…       — browse by pad type`,
    ``,
    `Drop WAVs into Ableton Live (Push / MPD Live 2).`,
    `New uploads are silence-trimmed so pads fire immediately; originals stay in admin.`,
    `Drag individual pads from the admin UI also works (Chrome/Edge desktop).`,
    ``,
    `manifest.json lists every clip for future Ableton / MPC pack tooling.`,
    ``,
  ].join("\n");
}
