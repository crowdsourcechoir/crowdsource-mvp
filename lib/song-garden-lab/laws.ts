import { RULES_VERSION, type Conditions, type Genome, type Laws } from "./types";

export function zeroConditions(): Conditions {
  return { density: 0, pulse: 0, tension: 0 };
}

export function defaultLaws(partial?: Partial<Laws>): Laws {
  return {
    rulesVersion: RULES_VERSION,
    coupling: 0,
    depositGain: 0.08,
    leak: { density: 0, pulse: 0, tension: 0 },
    mute: { density: false, pulse: false, tension: false },
    limits: { scale: 0.12, period: 0.2, curvature: 0.35, asymmetry: 0.3 },
    resistanceStrength: 1,
    branchFromTension: false,
    originMode: "pure",
    linearFoil: false,
    armThreshold: 0.55,
    lengthScale: 1,
    widthScale: 1,
    curvatureScale: 1,
    armLength: 1,
    swayEnabled: true,
    swayAmplitude: 0.07,
    showLabels: true,
    ...partial,
    leak: { density: 0, pulse: 0, tension: 0, ...partial?.leak },
    mute: { density: false, pulse: false, tension: false, ...partial?.mute },
    limits: {
      scale: 0.12,
      period: 0.2,
      curvature: 0.35,
      asymmetry: 0.3,
      ...partial?.limits,
    },
  };
}

export function syntheticGenome(partial?: Partial<Genome>): Genome {
  return {
    force: 0.5,
    sustain: 0.5,
    stillness: 0.2,
    brightness: 0.5,
    articulation: 0.3,
    motion: 0.4,
    pitchConfidence: 0,
    register: 0.5,
    motionSource: "synthetic",
    ...partial,
  };
}
