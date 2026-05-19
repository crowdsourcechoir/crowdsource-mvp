export type SongGardenSoundType =
  | "choir_vowel"
  | "breath_texture"
  | "rhythmic_chop"
  | "whispered_word"
  | "melodic_phrase"
  | "open_seed"
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

const LEGACY_CONSENT_COPY =
  "I consent to my voice or words being used as source material for this event's Song Garden and performance assets.";
const CURRENT_CONSENT_COPY =
  "I consent to my voice, video and words to be used as source material for Crowdsource Choir performance assets.";

export const DEFAULT_SONG_GARDEN_PROMPTS: SongGardenPrompt[] = [
  {
    id: "ahh-c",
    title: "Sung Ahh (root)",
    instruction: "Sing Ahh with this tone. Let it bloom, then fade.",
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
    id: "ahh-g",
    title: "Sung Ahh (5)",
    instruction: "Sing Ahh with this tone. Let it bloom, then fade.",
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
    id: "ohh-a",
    title: "Sung Ahh (6)",
    instruction: "Sing Ohh with this tone. Let it bloom, then fade.",
    soundType: "choir_vowel",
    assetCategory: "choir_samples",
    pitch: "A4",
    midiNote: 69,
    guideToneHz: 440,
    maxSeconds: 8,
    allowAudio: true,
    allowText: false,
  },
  {
    id: "ohh-f",
    title: "Sung Ahh (4)",
    instruction: "Sing Ohh with this tone. Let it bloom, then fade.",
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
    instruction: "Give us one big sigh.",
    soundType: "breath_texture",
    assetCategory: "breath_textures",
    maxSeconds: 5,
    allowAudio: true,
    allowText: false,
  },
  {
    id: "rhythm-hey",
    title: "Short rhythm",
    instruction: "Give us one short clap or finger snap.",
    soundType: "rhythmic_chop",
    assetCategory: "vocal_chops",
    maxSeconds: 4,
    allowAudio: true,
    allowText: false,
  },
  {
    id: "whisper-word",
    title: "Whisper one word",
    instruction: "Say one word this gathering carries for you.",
    soundType: "whispered_word",
    assetCategory: "vocal_chops",
    maxSeconds: 4,
    allowAudio: true,
    allowText: false,
  },
  {
    id: "say-anything",
    title: "Say or sing anything you want",
    instruction: "Say or sing anything you want.",
    soundType: "open_seed",
    assetCategory: "choir_samples",
    maxSeconds: 20,
    allowAudio: true,
    allowText: false,
  },
];

export const DEFAULT_SONG_GARDEN_CONFIG: SongGardenConfig = {
  enabled: true,
  exportBpm: 96,
  chordProgression: ["C", "G", "Am", "F"],
  consentCopy: CURRENT_CONSENT_COPY,
  prompts: DEFAULT_SONG_GARDEN_PROMPTS,
};

function normalizeConsentCopy(copy: string): string {
  return copy === LEGACY_CONSENT_COPY ? CURRENT_CONSENT_COPY : copy;
}

const MANAGED_PROMPT_IDS = new Set([
  "ahh-c",
  "ohh-g",
  "hum-a",
  "ahh-f",
  "ahh-g",
  "ohh-a",
  "ohh-f",
  "breath-texture",
  "rhythm-hey",
  "whisper-word",
  "lyric-text",
  "say-anything",
]);

export function normalizeSongGardenConfig(input: unknown): SongGardenConfig | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<SongGardenConfig>;
  if (!raw.enabled) return null;
  const rawPrompts = Array.isArray(raw.prompts) && raw.prompts.length > 0 ? raw.prompts : DEFAULT_SONG_GARDEN_PROMPTS;
  const usesManagedPromptPack = rawPrompts.every((prompt) => MANAGED_PROMPT_IDS.has(prompt.id));
  const prompts = usesManagedPromptPack ? DEFAULT_SONG_GARDEN_PROMPTS : rawPrompts;
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
