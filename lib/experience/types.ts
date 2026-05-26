/** Allowed participation modes — refs Protocols/participation-taxonomy.md */
export type ParticipationModeId =
  | "unison_repeat"
  | "call_response"
  | "ab_selection"
  | "sectional_split"
  | "dynamic_control"
  | "layer_addition"
  | "controlled_sample_capture";

export type ExperienceStageId = "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7";

export type ExperienceArcId = "full_show" | "ceremony";

export type ExperienceStage = {
  id: ExperienceStageId;
  /** Short label for Conductor nav */
  name: string;
  /** Full protocol title */
  title: string;
  purpose: string;
  defaultMinutes: number;
  expandable: boolean;
  emotionalTarget: string;
  participationModes: ParticipationModeId[];
  maxParticipationBeats: number;
  signalAllowed: boolean;
  restBeat: boolean;
  compositionOutputs: string[];
  transitionCue: string;
  recoveryMove: string;
};

export type ExperienceArc = {
  id: ExperienceArcId;
  name: string;
  description: string;
  stageIds: ExperienceStageId[];
};

export type ResolvedExperiencePlan = {
  arcId: ExperienceArcId;
  arcName: string;
  arcDescription: string;
  /** Pre-show emotional arc from agent brief, if set */
  eventEmotionalArc?: string;
  stages: ExperienceStage[];
  totalDefaultMinutes: number;
};

export type ConductorPersistedState = {
  arcId: ExperienceArcId;
  currentStageIndex: number;
  participationBeatsByStageId: Partial<Record<ExperienceStageId, number>>;
  restBeatActive: boolean;
};
