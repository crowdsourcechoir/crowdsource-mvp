export type SonggardenCategoryId =
  | "ambient"
  | "foley"
  | "percussion"
  | "vocal"
  | "texture"
  | "other";

/** Silence-trim state for pad-ready playback. */
export type SonggardenTrimStatus = "none" | "trimmed" | "skipped";

export type SonggardenClip = {
  id: string;
  eventId: string;
  contributorName: string | null;
  label: string | null;
  category: SonggardenCategoryId;
  filename: string;
  mimeType: string;
  durationMs: number | null;
  deviceId: string;
  sessionToken: string | null;
  submittedAt: string;
  /** Leading silence removed from playable WAV (ms). */
  trimLeadMs: number | null;
  /** Trailing silence removed from playable WAV (ms). */
  trimTrailMs: number | null;
  trimStatus: SonggardenTrimStatus;
  /** True when an untrimmed original is stored for audition / restore. */
  hasOriginal: boolean;
};

export type SonggardenClipMeta = Omit<SonggardenClip, never>;
