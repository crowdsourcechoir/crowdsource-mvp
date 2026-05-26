export type SonggardenCategoryId =
  | "ambient"
  | "foley"
  | "percussion"
  | "vocal"
  | "texture"
  | "other";

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
};

export type SonggardenClipMeta = Omit<SonggardenClip, never>;
