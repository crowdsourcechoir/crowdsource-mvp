import type { CompositionSourceCounts, SignalResolution } from "@/lib/composition/types";

/** How archived material may be reused in future shows. */
export type ConsentTier =
  | "internal_only"
  | "reuse_anonymous"
  | "reuse_attributed"
  | "reuse_public"
  | "do_not_store";

export type ConsentTaggedLine = {
  text: string;
  tier: ConsentTier;
  attribution?: string;
  source: "interview" | "live" | "composition" | "song_seed";
  sourceId?: string;
  voteCount?: number;
};

export type TranscriptRef = {
  turnId: string;
  conversationId?: string;
  participantLabel?: string;
  mediaType?: "audio" | "video" | "text";
  tier: ConsentTier;
};

export type MediaRef = {
  turnId: string;
  url: string;
  mediaType: "audio" | "video";
  tier: ConsentTier;
};

export type EventMemoryMeta = {
  eventId: string;
  slug: string;
  title: string;
  date: string;
  time: string;
  venue: string;
};

export type EventMemoryRecord = {
  id: string;
  eventId: string;
  finalizedAt: string;
  finalizedBy: "joel" | "system";
  version: number;

  eventMeta: EventMemoryMeta;
  sessionIds: string[];

  anthemFragments: {
    hooks: ConsentTaggedLine[];
    chantableLines: ConsentTaggedLine[];
    lockedPhrases: ConsentTaggedLine[];
  };

  voiceSamples: {
    transcriptRefs: TranscriptRef[];
    mediaRefs: MediaRef[];
  };

  emotionalProfile: {
    summary: string;
    themes: string[];
    arc: string;
    contrasts: string[];
  };

  signalProfile: {
    resolutions: SignalResolution[];
    textureNotes: string[];
  };

  compositionArtifacts: {
    songSeedId?: string;
    compositionBriefId?: string;
    sunoPrompts: string[];
  };

  sourceCounts: CompositionSourceCounts;

  /** Lines safe for anonymous reuse (export subset). */
  reusableExport: ConsentTaggedLine[];
};

export type AssembleMemoryOptions = {
  eventId: string;
};

export type FinalizeMemoryOptions = {
  eventId: string;
  finalizedBy?: "joel" | "system";
};
