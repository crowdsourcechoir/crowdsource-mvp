import { applyDeposit, conditionsClose, depositOf, heardConditions } from "./conditions";
import { expressChannels } from "./express";
import { realizeRibbon } from "./grammar";
import { zeroConditions } from "./laws";
import { hash01 } from "./hash-id";
import type {
  CompostPayload,
  Conditions,
  FoldResult,
  Genome,
  LabEvent,
  Laws,
  Organism,
  PlantedPayload,
} from "./types";

export type LogEntry = { id: string; genome: Genome };

function isPlanted(payload: LabEvent["payload"]): payload is PlantedPayload {
  return Boolean(payload && typeof payload === "object" && "genome" in payload);
}

function isCompost(payload: LabEvent["payload"]): payload is CompostPayload {
  return Boolean(payload && typeof payload === "object" && "organismId" in payload && "returns" in payload);
}

function placeX(id: string, birth: Conditions, taken: number[]): number {
  const spread = 0.9 * (1 - 0.35 * birth.density);
  const preferred = 0.5 + (hash01(id, 1) - 0.5) * spread;
  const minSep = 0.052 * (1 - 0.35 * birth.density);
  const within = (x: number) => taken.some((other) => Math.abs(other - x) < minSep);
  const clampX = (x: number) => Math.max(0.05, Math.min(0.95, x));
  if (!within(preferred)) return clampX(preferred);
  for (let step = 1; step <= 48; step++) {
    for (const dir of [-1, 1]) {
      const x = clampX(preferred + dir * step * minSep * 0.45);
      if (!within(x)) return x;
    }
  }
  return clampX(preferred);
}

export function organismFrom(
  id: string,
  genome: Genome,
  birth: Conditions,
  deposit: Conditions,
  takenX: number[],
  laws: Laws
): Organism {
  const expressed = expressChannels(genome, birth, laws);
  const ribbon = realizeRibbon(genome, expressed, laws);
  const position = { x: placeX(id, heardConditions(birth, laws), takenX), y: 0.78 };
  return {
    id,
    genome,
    birthConditions: birth,
    deposit,
    position,
    expressed,
    ribbon,
    motion: {
      periodSec: 2.3 + expressed.period * 5.2,
      phase: hash01(id, 9) * Math.PI * 2,
    },
    rulesVersion: laws.rulesVersion,
  };
}

/** Fold a planted log. Compost removes a body and returns material. Unknown types are listed. */
export function foldEvents(events: LabEvent[], laws: Laws): FoldResult {
  let conditions = zeroConditions();
  const living = new Map<string, Organism>();
  const plantedOrder: string[] = [];
  const warnings: string[] = [];
  const trajectory: Conditions[] = [{ ...conditions }];
  const takenX: number[] = [];

  for (const event of events) {
    if (event.type === "contribution.planted" && isPlanted(event.payload)) {
      const birth = { ...conditions };
      const deposit = depositOf(event.payload.genome, birth, laws);
      if (
        event.payload.sealed &&
        event.payload.birthConditions &&
        !conditionsClose(event.payload.birthConditions, birth)
      ) {
        warnings.push(`stale birth snapshot on ${event.id}`);
      }
      const organism = organismFrom(event.id, event.payload.genome, birth, deposit, takenX, laws);
      takenX.push(organism.position.x);
      living.set(event.id, organism);
      plantedOrder.push(event.id);
      conditions = applyDeposit(conditions, deposit, laws.leak);
    } else if (event.type === "compost" && isCompost(event.payload)) {
      if (!living.has(event.payload.organismId)) {
        warnings.push(`compost missing ${event.payload.organismId}`);
      } else {
        living.delete(event.payload.organismId);
        conditions = applyDeposit(conditions, event.payload.returns, laws.leak);
      }
    } else {
      warnings.push(`skipped ${event.type}`);
    }
    trajectory.push({ ...conditions });
  }

  return {
    conditions,
    organisms: plantedOrder.filter((id) => living.has(id)).map((id) => living.get(id)!),
    trajectory,
    warnings,
  };
}

export function eventsFromLog(entries: LogEntry[], laws: Laws): LabEvent[] {
  return entries.map((entry, index) => ({
    id: entry.id,
    index,
    type: "contribution.planted",
    rulesVersion: laws.rulesVersion,
    at: "",
    payload: {
      genome: entry.genome,
      genomeId: entry.id,
      birthConditions: zeroConditions(),
      deposit: zeroConditions(),
      position: { x: 0, y: 0 },
    },
  }));
}

export function foldLog(entries: LogEntry[], laws: Laws): FoldResult {
  return foldEvents(eventsFromLog(entries, laws), laws);
}
