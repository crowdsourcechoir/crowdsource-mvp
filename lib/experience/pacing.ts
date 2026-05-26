import type { ExperienceStage, ExperienceStageId } from "@/lib/experience/types";

export function participationBeatsUsed(
  stageId: ExperienceStageId,
  byStage: Partial<Record<ExperienceStageId, number>>
): number {
  return byStage[stageId] ?? 0;
}

export function participationBudgetRemaining(
  stage: ExperienceStage,
  byStage: Partial<Record<ExperienceStageId, number>>
): number {
  return Math.max(0, stage.maxParticipationBeats - participationBeatsUsed(stage.id, byStage));
}

export function canUseParticipationBeat(
  stage: ExperienceStage,
  byStage: Partial<Record<ExperienceStageId, number>>,
  restBeatActive: boolean
): boolean {
  if (restBeatActive) return false;
  return participationBudgetRemaining(stage, byStage) > 0;
}

export function isSignalAllowed(stage: ExperienceStage, restBeatActive: boolean): boolean {
  if (restBeatActive) return false;
  return stage.signalAllowed;
}

export function isParticipationBudgetExceeded(
  stage: ExperienceStage,
  byStage: Partial<Record<ExperienceStageId, number>>
): boolean {
  return participationBeatsUsed(stage.id, byStage) >= stage.maxParticipationBeats;
}
