import { foldEvents } from "./fold";
import { clamp } from "./quantize";
import type { Conditions, FoldResult, Genome, LabEvent, Laws } from "./types";

export type LogStep =
  | { id: string; type: "contribution.planted"; genome: Genome }
  | { id: string; type: "compost"; organismId: string; returns: Conditions }
  | { id: string; type: "tick" };

export function scaleConditions(conditions: Conditions, fraction: number): Conditions {
  const gain = clamp(fraction);
  return {
    density: conditions.density * gain,
    pulse: conditions.pulse * gain,
    tension: conditions.tension * gain,
  };
}

export function plantedSteps(entries: { id: string; genome: Genome }[]): LogStep[] {
  return entries.map((entry) => ({
    id: entry.id,
    type: "contribution.planted" as const,
    genome: { ...entry.genome },
  }));
}

export function stepsToEvents(steps: LogStep[], laws: Laws): LabEvent[] {
  return steps.map((step, index) => {
    if (step.type === "compost") {
      return {
        id: step.id,
        index,
        type: "compost",
        rulesVersion: laws.rulesVersion,
        at: "",
        payload: { organismId: step.organismId, returns: step.returns },
      };
    }
    if (step.type === "tick") {
      return {
        id: step.id,
        index,
        type: "tick",
        rulesVersion: laws.rulesVersion,
        at: "",
        payload: { seconds: 1 },
      };
    }
    return {
      id: step.id,
      index,
      type: "contribution.planted",
      rulesVersion: laws.rulesVersion,
      at: "",
      payload: { genome: step.genome, genomeId: step.id },
    };
  });
}

export function foldSteps(steps: LogStep[], laws: Laws): FoldResult {
  return foldEvents(stepsToEvents(steps, laws), laws);
}
