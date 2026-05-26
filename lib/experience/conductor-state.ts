import type { ConductorPersistedState, ExperienceArcId } from "@/lib/experience/types";
import { DEFAULT_EXPERIENCE_ARC_ID } from "@/lib/experience/resolve-plan";

const STORAGE_PREFIX = "octo_conductor_state_v1_";

export function conductorStorageKey(eventId: string): string {
  return `${STORAGE_PREFIX}${eventId}`;
}

export function loadConductorState(eventId: string): ConductorPersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(conductorStorageKey(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConductorPersistedState;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      arcId: parsed.arcId === "ceremony" ? "ceremony" : "full_show",
      currentStageIndex: Math.max(0, Number(parsed.currentStageIndex) || 0),
      participationBeatsByStageId: parsed.participationBeatsByStageId ?? {},
      restBeatActive: !!parsed.restBeatActive,
    };
  } catch {
    return null;
  }
}

export function saveConductorState(eventId: string, state: ConductorPersistedState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(conductorStorageKey(eventId), JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

export function defaultConductorState(arcId: ExperienceArcId = DEFAULT_EXPERIENCE_ARC_ID): ConductorPersistedState {
  return {
    arcId,
    currentStageIndex: 0,
    participationBeatsByStageId: {},
    restBeatActive: false,
  };
}
