import { getExperienceArc, stagesForArc } from "@/lib/experience/arc-catalog";
import type {
  ExperienceArcId,
  ExperienceStage,
  ExperienceStageId,
  ResolvedExperiencePlan,
} from "@/lib/experience/types";

export type ResolveExperiencePlanOptions = {
  arcId?: ExperienceArcId | null;
  /** From event agentBrief.emotionalArc — colors S1, S4, S7 */
  emotionalArc?: string | null;
};

const EMOTIONAL_MERGE_STAGES: ExperienceStageId[] = ["S1", "S4", "S7"];

/** Default arc when none is configured — preserves full 7-stage Conductor behavior. */
export const DEFAULT_EXPERIENCE_ARC_ID: ExperienceArcId = "full_show";

function mergeEmotionalArc(stage: ExperienceStage, eventEmotionalArc: string): ExperienceStage {
  return {
    ...stage,
    emotionalTarget: `${stage.emotionalTarget} · Event tone: ${eventEmotionalArc}`,
  };
}

export function resolveExperiencePlan(options: ResolveExperiencePlanOptions = {}): ResolvedExperiencePlan {
  const arcId = options.arcId ?? DEFAULT_EXPERIENCE_ARC_ID;
  const emotionalArc = options.emotionalArc?.trim() || undefined;
  const arc = getExperienceArc(arcId);
  const arcStages = stagesForArc(arcId);

  const stages = arcStages.map((stage) => {
    if (emotionalArc && EMOTIONAL_MERGE_STAGES.includes(stage.id)) {
      return mergeEmotionalArc(stage, emotionalArc);
    }
    return stage;
  });

  return {
    arcId,
    arcName: arc.name,
    arcDescription: arc.description,
    eventEmotionalArc: emotionalArc,
    stages,
    totalDefaultMinutes: stages.reduce((sum, s) => sum + s.defaultMinutes, 0),
  };
}
