import { SCORE_COMPONENT_KEYS, type ScoreComponentKey } from "../types";

/**
 * Default component weights, sum to 1. The model proposes each component's 0-10 score +
 * rationale; the weighted total below is always computed here in code, never by the model
 * — see docs/sales-platform/ai-workflow.md §6.
 */
export const DEFAULT_SCORE_WEIGHTS: Record<ScoreComponentKey, number> = {
  participatory_program_fit: 0.15,
  event_relevance: 0.13,
  audience_size: 0.12,
  budget_likelihood: 0.12,
  decision_maker_access: 0.1,
  strategic_value: 0.08,
  research_confidence: 0.07,
  timing: 0.07,
  repeat_business_potential: 0.06,
  geographic_fit: 0.05,
  contact_quality: 0.05,
};

const weightSum = SCORE_COMPONENT_KEYS.reduce((sum, key) => sum + DEFAULT_SCORE_WEIGHTS[key], 0);
if (Math.abs(weightSum - 1) > 0.001) {
  throw new Error(`DEFAULT_SCORE_WEIGHTS must sum to 1, got ${weightSum}`);
}

export const SCORE_COMPONENT_LABELS: Record<ScoreComponentKey, string> = {
  audience_size: "Audience size",
  event_relevance: "Event relevance",
  participatory_program_fit: "Participatory-program fit",
  budget_likelihood: "Budget likelihood",
  timing: "Timing",
  geographic_fit: "Geographic fit",
  decision_maker_access: "Access to decision-maker",
  strategic_value: "Strategic value",
  repeat_business_potential: "Repeat-business potential",
  research_confidence: "Confidence in the research",
  contact_quality: "Contact quality",
};
