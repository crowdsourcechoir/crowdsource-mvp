/** Experiment A laws. One version until a season boundary exists. */
export const RULES_VERSION = "lab-a-1";

export const QUANTIZE_STEPS = 63;

export type MotionSource = "pitch" | "flux" | "synthetic";

/** Portable genome. Structural axes are 0..1 on a 64-step grid. */
export type Genome = {
  force: number;
  sustain: number;
  stillness: number;
  brightness: number;
  articulation: number;
  motion: number;
  /** Latent. Not a structural axis. */
  pitchConfidence: number;
  /** Latent register for a future sound interpreter. */
  register: number;
  motionSource: MotionSource;
};

export type StructuralAxis = "force" | "sustain" | "stillness" | "brightness" | "articulation" | "motion";

export const STRUCTURAL_AXES: StructuralAxis[] = [
  "force",
  "sustain",
  "stillness",
  "brightness",
  "articulation",
  "motion",
];

export type Conditions = {
  density: number;
  pulse: number;
  tension: number;
};

export type OriginMode = "pure" | "centered";

export type Laws = {
  rulesVersion: string;
  coupling: number;
  depositGain: number;
  leak: Conditions;
  mute: { density: boolean; pulse: boolean; tension: boolean };
  limits: { scale: number; period: number; curvature: number; asymmetry: number };
  /** 0 ignores genomic stubbornness. 1 uses the full resistance formula. */
  resistanceStrength: number;
  /** Experimental. Default off. Tension may add a secondary arm. */
  branchFromTension: boolean;
  originMode: OriginMode;
  /** One-to-one mapping foil. Default off. */
  linearFoil: boolean;
  armThreshold: number;
  lengthScale: number;
  widthScale: number;
  curvatureScale: number;
  armLength: number;
  swayEnabled: boolean;
  /** Radians at the tip. */
  swayAmplitude: number;
  showLabels: boolean;
  /** Force above this is compressed in the grammar. Default 0.75. */
  forceKnee: number;
  /** Fraction of a body's own deposit that returns to the ground when it is composted. */
  compostFraction: number;
  /** Faint view of a returned body. Not a second organism. */
  showRemnants: boolean;
};

export type Tendencies = {
  scale: number;
  curvature: number;
  asymmetry: number;
  fineness: number;
  /** 0 is fast, 1 is slow. Pulse pushes this down. */
  period: number;
  secondaryArm: boolean;
};

export type Expressed = Tendencies & {
  resistance: number;
  effectiveCoupling: number;
};

export type Point = { x: number; y: number };

export type Ribbon = {
  spine: Point[];
  widths: number[];
  arm: Point[] | null;
  armWidths: number[] | null;
  /** 0..1 along the spine where the arm leaves. */
  armStart: number;
};

export type Organism = {
  id: string;
  genome: Genome;
  birthConditions: Conditions;
  deposit: Conditions;
  /** Field position. x and y are 0..1 of the viewport. y is the ground line. */
  position: Point;
  expressed: Expressed;
  ribbon: Ribbon;
  motion: { periodSec: number; phase: number };
  rulesVersion: string;
};

/** Draw-time layer. A–C fills sway only. */
export type Behavior = {
  swayAmplitude: number;
  orientationBias: number;
  luminosity: number;
  tipOpen: number;
  sonicActive: boolean;
  neighborLean: number;
};

export type PlantedPayload = {
  genome: Genome;
  genomeId: string;
  /** Present when a client stored a snapshot. The fold recomputes and warns if they disagree. */
  birthConditions?: Conditions;
  deposit?: Conditions;
  position?: Point;
  sealed?: boolean;
};

export type CompostPayload = {
  organismId: string;
  returns: Conditions;
};

export type LabEvent = {
  id: string;
  index: number;
  type: string;
  rulesVersion: string;
  at: string;
  payload: PlantedPayload | CompostPayload | Record<string, unknown>;
};

export type FoldResult = {
  conditions: Conditions;
  organisms: Organism[];
  /** Bodies removed by compost, frozen as they were when they left. */
  remnants: Organism[];
  trajectory: Conditions[];
  warnings: string[];
};
