import { SCORE_COMPONENT_KEYS, type ScoreComponent, type ScoreComponentKey } from "../types";
import { DEFAULT_SCORE_WEIGHTS } from "./model";

/**
 * Pure, deterministic weighted total — the model never emits an unexplained final number.
 * Component scores (0-10) come from the scoring stage's structured output.
 */
export function computeTotalScore(
  componentScores: Record<ScoreComponentKey, Omit<ScoreComponent, "weight">>,
  weightOverrides?: Partial<Record<ScoreComponentKey, number>>
): { total: number; components: Record<ScoreComponentKey, ScoreComponent> } {
  const weights = { ...DEFAULT_SCORE_WEIGHTS, ...weightOverrides };
  let total = 0;
  const components = {} as Record<ScoreComponentKey, ScoreComponent>;
  for (const key of SCORE_COMPONENT_KEYS) {
    const weight = weights[key];
    const c = componentScores[key];
    total += (c.score / 10) * weight;
    components[key] = { ...c, weight };
  }
  return { total: Math.round(total * 1000) / 10, components }; // 0-100, one decimal
}
