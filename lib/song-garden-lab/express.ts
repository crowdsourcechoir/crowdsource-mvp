import { heardConditions } from "./conditions";
import { clamp } from "./quantize";
import type { Conditions, Expressed, Genome, Laws, Tendencies } from "./types";

function knee(x: number, at: number): number {
  if (x <= at) return x;
  return at + (x - at) * 0.35;
}

export function tendenciesOf(genome: Genome, laws: Laws): Tendencies {
  const arm = genome.articulation * genome.motion >= laws.armThreshold;
  if (laws.linearFoil) {
    return {
      scale: genome.force,
      curvature: genome.motion,
      asymmetry: genome.stillness,
      fineness: genome.brightness,
      period: 1 - genome.articulation,
      secondaryArm: arm,
    };
  }
  const force = knee(genome.force, laws.forceKnee);
  return {
    scale: clamp(0.32 + 0.68 * Math.sqrt(force * (0.25 + 0.75 * genome.sustain))),
    curvature: clamp(Math.pow(genome.motion, 1.35) * (0.55 + 0.45 * (1 - genome.stillness))),
    asymmetry: clamp(genome.stillness * (0.35 + 0.65 * genome.motion)),
    fineness: clamp(genome.brightness * (1 - 0.55 * force)),
    period: clamp(0.42 + 0.58 * (1 - genome.articulation)),
    secondaryArm: arm,
  };
}

export function resistanceOf(genome: Genome): number {
  return clamp(0.15 + 0.85 * genome.force * genome.sustain);
}

function deltaFor(condition: number, laws: Laws): number {
  if (laws.originMode === "centered") return Math.tanh(2.2 * (condition - 0.5));
  return Math.tanh(2.2 * condition);
}

function push(tendency: number, delta: number, effective: number, limit: number, direction: 1 | -1): number {
  return clamp(tendency + direction * effective * limit * delta);
}

/**
 * Genome proposes. Birth conditions may push assigned channels only.
 * Zero conditions and zero coupling leave the tendency untouched.
 */
export function expressChannels(genome: Genome, birth: Conditions, laws: Laws): Expressed {
  const heard = heardConditions(birth, laws);
  const base = tendenciesOf(genome, laws);
  const resistance = resistanceOf(genome);
  const stubborn = resistance * laws.resistanceStrength;
  const effective = laws.coupling * (1 - stubborn);
  const densityDelta = deltaFor(heard.density, laws);
  const pulseDelta = deltaFor(heard.pulse, laws);
  const tensionDelta = deltaFor(heard.tension, laws);

  let secondaryArm = base.secondaryArm;
  if (laws.branchFromTension && heard.tension * genome.motion >= laws.armThreshold) {
    secondaryArm = true;
  }

  return {
    scale: push(base.scale, densityDelta, effective, laws.limits.scale, -1),
    curvature: push(base.curvature, tensionDelta, effective, laws.limits.curvature, 1),
    asymmetry: push(base.asymmetry, tensionDelta, effective, laws.limits.asymmetry, 1),
    fineness: base.fineness,
    period: push(base.period, pulseDelta, effective, laws.limits.period, -1),
    secondaryArm,
    resistance,
    effectiveCoupling: effective,
  };
}
