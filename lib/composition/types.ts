import type { MusicalLayerType } from "@/data/signalPromptBlock";

/** Verbatim text usable as lyric material. */
export type CompositionTextLine = {
  text: string;
  source: "interview" | "live";
  sourceId?: string;
  participantId?: string;
  participantLabel?: string;
  conversationId?: string;
  roundId?: string;
  sessionId?: string;
  createdAt?: string;
};

/** Speech extracted from voice or video interview turns. */
export type CompositionTranscriptSegment = {
  text: string;
  mediaType: "audio" | "video";
  turnId: string;
  participantId?: string;
  participantLabel?: string;
  conversationId?: string;
  createdAt?: string;
};

/** Audience phrase surfaced by live voting (game rounds). */
export type CompositionPhraseCard = {
  id: string;
  rawText: string;
  voteCount: number;
  roundId: string;
  sessionId: string;
  locked: boolean;
};

/** Collective Signal choice for a musical layer (computed from votes). */
export type SignalResolution = {
  roundId: string;
  sessionId: string;
  layer: MusicalLayerType;
  winningChoiceId: string;
  label: string;
  triggerId: string;
  voteCount: number;
  promptText?: string;
  closedAt?: string | null;
};

export type CompositionSourceCounts = {
  interviewTurns: number;
  liveSubmissions: number;
  signalRounds: number;
  phraseCards: number;
};

/** Raw material gathered from Participation + Signal layers. */
export type CompositionGatherResult = {
  eventId: string | null;
  sessionIds: string[];
  textLines: CompositionTextLine[];
  transcriptSegments: CompositionTranscriptSegment[];
  phraseCards: CompositionPhraseCard[];
  signalResolutions: SignalResolution[];
  sourceCounts: CompositionSourceCounts;
};

export type GatherCompositionInputsOptions = {
  eventId?: string | null;
  sessionId?: string | null;
};

export type CompositionLyricTheme = {
  label: string;
  exampleLines: string[];
};

/** Joel-facing creative brief assembled from gathered material. */
export type CompositionBrief = {
  id: string;
  eventId: string | null;
  sessionIds: string[];
  generatedAt: string;
  creativeSummary: string;
  lyricThemes: CompositionLyricTheme[];
  strongestPhrases: string[];
  hookCandidates: string[];
  chantableLines: string[];
  emotionalArc: string;
  signalTextureNotes: string[];
  shoutouts: string[];
  sunoPrompts: string[];
  signalResolutions: SignalResolution[];
  sourceCounts: CompositionSourceCounts;
};

export type BuildCompositionBriefOptions = GatherCompositionInputsOptions;
