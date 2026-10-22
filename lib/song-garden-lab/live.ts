import type { Behavior, Conditions, Laws, Organism } from "./types";

/**
 * Draw-time behavior. Phase A uses intrinsic sway only.
 * Neighbors and current conditions are accepted so later response does not
 * require a new call shape.
 */
export function live(
  organism: Organism,
  _current: Conditions,
  _neighbors: Organism[],
  laws: Laws
): Behavior {
  return {
    swayAmplitude: laws.swayEnabled ? laws.swayAmplitude : 0,
    orientationBias: 0,
    luminosity: 1,
    tipOpen: organism.expressed.fineness,
    sonicActive: false,
    neighborLean: 0,
  };
}
