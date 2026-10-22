import { clamp } from "./quantize";
import type { Conditions, Genome, Laws } from "./types";
import { zeroConditions } from "./laws";

/** Deposit from a genome into the garden, given the conditions it arrived in. */
export function depositOf(genome: Genome, current: Conditions, laws: Laws): Conditions {
  const g = laws.depositGain;
  const pulseNow = laws.mute.pulse ? 0 : current.pulse;
  return {
    density: laws.mute.density
      ? 0
      : g * (0.35 + 0.65 * genome.sustain * (1 - genome.stillness)) * (0.5 + 0.5 * genome.force),
    pulse: laws.mute.pulse ? 0 : g * genome.articulation,
    tension: laws.mute.tension ? 0 : g * genome.motion * (1 + 0.5 * pulseNow),
  };
}

/** Diminishing fill, then leak. Order matters. */
export function applyDeposit(current: Conditions, deposit: Conditions, leak: Conditions): Conditions {
  const step = (value: number, add: number, leakAmount: number) => {
    const filled = value + add * (1 - value);
    return clamp(filled * (1 - leakAmount));
  };
  return {
    density: step(current.density, deposit.density, leak.density),
    pulse: step(current.pulse, deposit.pulse, leak.pulse),
    tension: step(current.tension, deposit.tension, leak.tension),
  };
}

/** What germination is allowed to hear. */
export function heardConditions(conditions: Conditions, laws: Laws): Conditions {
  return {
    density: laws.mute.density ? 0 : conditions.density,
    pulse: laws.mute.pulse ? 0 : conditions.pulse,
    tension: laws.mute.tension ? 0 : conditions.tension,
  };
}

export function conditionsClose(a: Conditions, b: Conditions, eps = 1e-9): boolean {
  return (
    Math.abs(a.density - b.density) < eps &&
    Math.abs(a.pulse - b.pulse) < eps &&
    Math.abs(a.tension - b.tension) < eps
  );
}

export { zeroConditions };
