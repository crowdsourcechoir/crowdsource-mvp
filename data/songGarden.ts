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

const LEGACY_AHH_INSTRUCTION = "We need you to sing Ahh with this tone. Hold it steady and gentle.";
const CURRENT_AHH_INSTRUCTION = "Sing Ahh with this tone.";
const LEGACY_CONSENT_COPY =
  "I consent to my voice or words being used as source material for this event's Song Garden and performance assets.";
const CURRENT_CONSENT_COPY =
  "I consent to my voice, video and words to be used as source material for Crowdsource Choir performance assets.";

export const DEFAULT_SONG_GARDEN_PROMPTS: SongGardenPrompt[] = [
  {
    id: "ahh-c",
    title: "Sung Ahh 1",
    instruction: CURRENT_AHH_INSTRUCTION,
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
    instruction: "Sing Ohh with this tone.",
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
    instruction: "Hum with this tone.",
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
    id: "ahh-f",
    title: "Sung Ahh 2",
    instruction: CURRENT_AHH_INSTRUCTION,
    soundType: "choir_vowel",
    assetCategory: "choir_samples",
    pitch: "F4",
    midiNote: 65,
    guideToneHz: 349.23,
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
  consentCopy: CURRENT_CONSENT_COPY,
  prompts: DEFAULT_SONG_GARDEN_PROMPTS,
};

function normalizePromptInstruction(prompt: SongGardenPrompt): string {
  if (prompt.id === "ahh-c") {
    return CURRENT_AHH_INSTRUCTION;
  }
  return prompt.instruction;
}

function normalizeConsentCopy(copy: string): string {
  return copy === LEGACY_CONSENT_COPY ? CURRENT_CONSENT_COPY : copy;
}

export function normalizeSongGardenConfig(input: unknown): SongGardenConfig | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<SongGardenConfig>;
  if (!raw.enabled) return null;
  const prompts = Array.isArray(raw.prompts) && raw.prompts.length > 0 ? raw.prompts : DEFAULT_SONG_GARDEN_PROMPTS;
  const promptIds = new Set(prompts.map((prompt) => prompt.id));
  const promptsWithCurrentDefaults = [
    ...prompts,
    ...DEFAULT_SONG_GARDEN_PROMPTS.filter((prompt) => !promptIds.has(prompt.id)),
  ];
  return {
    enabled: true,
    exportBpm: typeof raw.exportBpm === "number" && raw.exportBpm > 0 ? raw.exportBpm : 96,
    chordProgression:
      Array.isArray(raw.chordProgression) && raw.chordProgression.length > 0
        ? raw.chordProgression.map(String)
        : ["C", "G", "Am", "F"],
    consentCopy: normalizeConsentCopy(
      typeof raw.consentCopy === "string" && raw.consentCopy.trim()
        ? raw.consentCopy
        : DEFAULT_SONG_GARDEN_CONFIG.consentCopy
    ),
    prompts: promptsWithCurrentDefaults.map((prompt) => ({
      ...prompt,
      instruction: normalizePromptInstruction(prompt),
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
