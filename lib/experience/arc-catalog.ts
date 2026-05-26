import type {
  ExperienceArc,
  ExperienceArcId,
  ExperienceStage,
  ExperienceStageId,
  ParticipationModeId,
} from "@/lib/experience/types";

export const PARTICIPATION_MODE_LABELS: Record<ParticipationModeId, string> = {
  unison_repeat: "Unison repeat",
  call_response: "Call and response",
  ab_selection: "A/B selection",
  sectional_split: "Sectional split",
  dynamic_control: "Volume sculpting",
  layer_addition: "Layer addition",
  controlled_sample_capture: "Controlled sample capture",
};

const STAGE_DEFINITIONS: Record<ExperienceStageId, ExperienceStage> = {
  S1: {
    id: "S1",
    name: "Arrival",
    title: "Arrival + Calibration",
    purpose: "Set tone, regulate nervous systems, unify attention.",
    defaultMinutes: 10,
    expandable: true,
    emotionalTarget: "scattered → regulated → attentive",
    participationModes: ["unison_repeat"],
    maxParticipationBeats: 1,
    signalAllowed: false,
    restBeat: true,
    compositionOutputs: [],
    transitionCue: "Hold the room in warmth. No asks yet — let attention gather.",
    recoveryMove: "Return to Unison Repeat — lock tempo with percussion cue.",
  },
  S2: {
    id: "S2",
    name: "Activation",
    title: "Collective Activation",
    purpose: "Engage voices early with simple, repeatable participation.",
    defaultMinutes: 15,
    expandable: true,
    emotionalTarget: "cautious → playful → confident",
    participationModes: ["unison_repeat", "call_response"],
    maxParticipationBeats: 3,
    signalAllowed: false,
    restBeat: false,
    compositionOutputs: [],
    transitionCue: "First voices together — low stakes, high repetition.",
    recoveryMove: "Return to Unison Repeat — reduce layers, remove voting.",
  },
  S3: {
    id: "S3",
    name: "Hooks",
    title: "Crowd-Proof Hooks Medley",
    purpose: "Build trust with familiar, guaranteed participation moments.",
    defaultMinutes: 15,
    expandable: false,
    emotionalTarget: "doubt → recognition → shared joy",
    participationModes: ["unison_repeat", "call_response", "sectional_split"],
    maxParticipationBeats: 4,
    signalAllowed: false,
    restBeat: false,
    compositionOutputs: [],
    transitionCue: "Familiar hooks only — guaranteed wins before creation.",
    recoveryMove: "Return to Unison Repeat — strip to one hook, loop it.",
  },
  S4: {
    id: "S4",
    name: "Modular Song Build",
    title: "Modular Song Creation",
    purpose: "Create original structured material inside a container.",
    defaultMinutes: 20,
    expandable: true,
    emotionalTarget: "curiosity → agency → ownership",
    participationModes: ["unison_repeat", "call_response", "ab_selection", "sectional_split"],
    maxParticipationBeats: 6,
    signalAllowed: true,
    restBeat: false,
    compositionOutputs: ["locked_hook", "locked_verse", "full_loop"],
    transitionCue: "Teach Hook A and B — vote, lock, repeat until owned.",
    recoveryMove: "Default to Hook A — shorten voting window, move to full loop early.",
  },
  S5: {
    id: "S5",
    name: "Genre Shift",
    title: "Genre Shift",
    purpose: "Reinterpret shared material across genres to expand range.",
    defaultMinutes: 15,
    expandable: true,
    emotionalTarget: "surprise → expansion → delight",
    participationModes: ["unison_repeat", "layer_addition", "dynamic_control"],
    maxParticipationBeats: 3,
    signalAllowed: true,
    restBeat: false,
    compositionOutputs: ["genre_variant"],
    transitionCue: "Same song, new skin — one palette shift, then hold.",
    recoveryMove: "Return to full loop from Stage 4 — drop genre experiment.",
  },
  S6: {
    id: "S6",
    name: "EDM Lift",
    title: "EDM / Choir-DJ Peak",
    purpose: "High-energy climax with drops, loops, and audience samples.",
    defaultMinutes: 20,
    expandable: true,
    emotionalTarget: "tension → surrender → catharsis",
    participationModes: [
      "unison_repeat",
      "dynamic_control",
      "layer_addition",
      "controlled_sample_capture",
    ],
    maxParticipationBeats: 4,
    signalAllowed: true,
    restBeat: false,
    compositionOutputs: ["sample_loop", "drop"],
    transitionCue: "Build → drop → loop. Samples only in pre-mapped slots.",
    recoveryMove: "Remove voting — harmonic bed only, maintain tempo manually.",
  },
  S7: {
    id: "S7",
    name: "Return",
    title: "Return / Blessing / Release",
    purpose: "Integrate, ground, and close the experience coherently.",
    defaultMinutes: 10,
    expandable: false,
    emotionalTarget: "exhilaration → gratitude → integration",
    participationModes: ["unison_repeat", "call_response"],
    maxParticipationBeats: 2,
    signalAllowed: false,
    restBeat: true,
    compositionOutputs: ["blessing_close"],
    transitionCue: "Soften. Witness the room. Close the loop with blessing.",
    recoveryMove: "Hold one phrase in unison — no new material.",
  },
};

export const EXPERIENCE_ARCS: Record<ExperienceArcId, ExperienceArc> = {
  full_show: {
    id: "full_show",
    name: "Full show",
    description: "All seven stages — ~2 hour expandable arc.",
    stageIds: ["S1", "S2", "S3", "S4", "S5", "S6", "S7"],
  },
  ceremony: {
    id: "ceremony",
    name: "One-song ceremony",
    description: "Arrival → Modular Song → Return (~45–60 min).",
    stageIds: ["S1", "S4", "S7"],
  },
};

export function getExperienceStage(id: ExperienceStageId): ExperienceStage {
  return STAGE_DEFINITIONS[id];
}

export function getExperienceArc(id: ExperienceArcId): ExperienceArc {
  return EXPERIENCE_ARCS[id];
}

export function listExperienceArcs(): ExperienceArc[] {
  return Object.values(EXPERIENCE_ARCS);
}

export function stagesForArc(arcId: ExperienceArcId): ExperienceStage[] {
  return getExperienceArc(arcId).stageIds.map((id) => getExperienceStage(id));
}
