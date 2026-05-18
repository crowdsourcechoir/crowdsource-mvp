export type SongGardenSoundType =
  | "choir_vowel"
  | "breath_texture"
  | "rhythmic_chop"
  | "whispered_word"
  | "melodic_phrase"
  | "lyric_text";

export type SongGardenAssetCategory =
  | "choir_samples"
  | "vocal_chops"
  | "breath_textures"
  | "midi_phrases"
  | "text_responses";

export type SongGardenPrompt = {
  id: string;
  title: string;
  instruction: string;
  soundType: SongGardenSoundType;
  assetCategory: SongGardenAssetCategory;
  pitch?: string;
  midiNote?: number;
  guideToneHz?: number;
  maxSeconds: number;
  allowAudio: boolean;
  allowText: boolean;
};

export type SongGardenConfig = {
  enabled: boolean;
  exportBpm: number;
  chordProgression: string[];
  consentCopy: string;
  prompts: SongGardenPrompt[];
};

export type SongGardenSubmissionStatus = "needs_review" | "approved" | "rejected";

export type SongGardenSubmission = {
  id: string;
  eventId: string;
  eventSlug: string;
  participantName: string | null;
  promptId: string;
  promptTitle: string;
  soundType: SongGardenSoundType;
  assetCategory: SongGardenAssetCategory;
  pitch: string | null;
  midiNote: number | null;
  consentStatus: boolean;
  textResponse: string | null;
  rawAudioUrl: string | null;
  processedAudioUrl: string | null;
  status: SongGardenSubmissionStatus;
  createdAt: string;
};

export const DEFAULT_SONG_GARDEN_PROMPTS: SongGardenPrompt[] = [
  {
    id: "ahh-c",
    title: "Sung Ahh",
    instruction: "We need you to sing Ahh with this tone. Hold it steady and gentle.",
    soundType: "choir_vowel",
    assetCategory: "choir_samples",
    pitch: "C4",
    midiNote: 60,
    guideToneHz: 261.63,
    maxSeconds: 8,
    allowAudio: true,
    allowText: false,
  },
  {
    id: "ohh-g",
    title: "Sung Ohh",
    instruction: "We need you to sing Ohh with this tone. Let it bloom, then fade.",
    soundType: "choir_vowel",
    assetCategory: "choir_samples",
    pitch: "G4",
    midiNote: 67,
    guideToneHz: 392,
    maxSeconds: 8,
    allowAudio: true,
    allowText: false,
  },
  {
    id: "hum-a",
    title: "Soft Hum",
    instruction: "We need you to hum softly with this tone. Keep it calm and steady.",
    soundType: "melodic_phrase",
    assetCategory: "midi_phrases",
    pitch: "A4",
    midiNote: 69,
    guideToneHz: 440,
    maxSeconds: 8,
    allowAudio: true,
    allowText: false,
  },
  {
    id: "breath-texture",
    title: "Breath texture",
    instruction: "Give us one soft breath, sigh, or wind-like sound.",
    soundType: "breath_texture",
    assetCategory: "breath_textures",
    maxSeconds: 5,
    allowAudio: true,
    allowText: false,
  },
  {
    id: "rhythm-hey",
    title: "Short rhythm",
    instruction: "Give us one short rhythmic sound: hey, ha, mm, clap, click, or stomp.",
    soundType: "rhythmic_chop",
    assetCategory: "vocal_chops",
    maxSeconds: 4,
    allowAudio: true,
    allowText: false,
  },
  {
    id: "whisper-word",
    title: "Whisper one word",
    instruction: "Whisper one word this gathering carries for you.",
    soundType: "whispered_word",
    assetCategory: "vocal_chops",
    maxSeconds: 4,
    allowAudio: true,
    allowText: true,
  },
  {
    id: "lyric-text",
    title: "Lyric seed",
    instruction: "Write one short line that should live in the anthem.",
    soundType: "lyric_text",
    assetCategory: "text_responses",
    maxSeconds: 0,
    allowAudio: false,
    allowText: true,
  },
];

export const DEFAULT_SONG_GARDEN_CONFIG: SongGardenConfig = {
  enabled: true,
  exportBpm: 96,
  chordProgression: ["C", "G", "Am", "F"],
  consentCopy:
    "I consent to my voice or words being used as source material for this event's Song Garden and performance assets.",
  prompts: DEFAULT_SONG_GARDEN_PROMPTS,
};

export function normalizeSongGardenConfig(input: unknown): SongGardenConfig | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<SongGardenConfig>;
  if (!raw.enabled) return null;
  const prompts = Array.isArray(raw.prompts) && raw.prompts.length > 0 ? raw.prompts : DEFAULT_SONG_GARDEN_PROMPTS;
  return {
    enabled: true,
    exportBpm: typeof raw.exportBpm === "number" && raw.exportBpm > 0 ? raw.exportBpm : 96,
    chordProgression:
      Array.isArray(raw.chordProgression) && raw.chordProgression.length > 0
        ? raw.chordProgression.map(String)
        : ["C", "G", "Am", "F"],
    consentCopy: typeof raw.consentCopy === "string" && raw.consentCopy.trim()
      ? raw.consentCopy
      : DEFAULT_SONG_GARDEN_CONFIG.consentCopy,
    prompts: prompts.map((prompt) => ({
      ...prompt,
      maxSeconds: Math.max(0, Math.min(20, Number(prompt.maxSeconds) || 8)),
      allowAudio: !!prompt.allowAudio,
      allowText: !!prompt.allowText,
    })),
  };
}

export function songGardenConfigFromBrief(brief: unknown): SongGardenConfig | null {
  if (!brief || typeof brief !== "object") return null;
  return normalizeSongGardenConfig((brief as { songGarden?: unknown }).songGarden);
}

export function slugifyAssetPart(input: string | null | undefined): string {
  const normalized = (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "untitled";
}
