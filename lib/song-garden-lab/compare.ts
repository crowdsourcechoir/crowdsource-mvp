import { conditionsClose } from "./conditions";
import { foldLog, type LogEntry } from "./fold";
import type { Conditions, Expressed, FoldResult, Laws, Organism } from "./types";

/** Published World B. 1-based indexes into the published field of twelve. Contribution #4 is h04. */
export const WORLD_B_ORDER = [8, 2, 11, 1, 5, 12, 3, 7, 9, 4, 6, 10] as const;

/** Debug fold. Not the proof. */
export const SHORT_B_ORDER = [3, 1, 4, 2] as const;

export const COUPLING_SWEEP = [0, 0.25, 0.5, 0.75, 1] as const;

export const SUBJECT_ID = "h04";

export function permuteField(field: LogEntry[], order: readonly number[]): LogEntry[] {
  return order.map((number) => {
    const id = `h${String(number).padStart(2, "0")}`;
    const entry = field.find((item) => item.id === id);
    if (!entry) throw new Error(`missing ${id}`);
    return entry;
  });
}

/** Distance on the expressed channels. Placement is reported separately. */
export function channelDistance(a: Expressed, b: Expressed): number {
  return Math.hypot(
    a.scale - b.scale,
    a.curvature - b.curvature,
    a.asymmetry - b.asymmetry,
    a.fineness - b.fineness,
    a.period - b.period,
    Number(a.secondaryArm) - Number(b.secondaryArm)
  );
}

export type CompareRow = {
  id: string;
  placeA: number;
  placeB: number;
  cross: number;
  placement: number;
  armA: boolean;
  armB: boolean;
  birthA: Conditions;
  birthB: Conditions;
  bendA: number;
  bendB: number;
};

export type CompareReport = {
  rows: CompareRow[];
  finalA: Conditions;
  finalB: Conditions;
  finalsDiffer: boolean;
  medianCross: number;
  medianWithinA: number;
  maxPlacement: number;
  armMismatches: number;
  subjectId: string;
  trajectoryA: Conditions[];
  trajectoryB: Conditions[];
};

export function compareFolds(worldA: FoldResult, worldB: FoldResult, subjectId = SUBJECT_ID): CompareReport {
  const byB = new Map(worldB.organisms.map((organism) => [organism.id, organism]));
  const rows: CompareRow[] = [];
  for (const organism of worldA.organisms) {
    const other = byB.get(organism.id);
    if (!other) continue;
    rows.push({
      id: organism.id,
      placeA: worldA.organisms.findIndex((item) => item.id === organism.id) + 1,
      placeB: worldB.organisms.findIndex((item) => item.id === organism.id) + 1,
      cross: channelDistance(organism.expressed, other.expressed),
      placement: Math.abs(organism.position.x - other.position.x),
      armA: organism.expressed.secondaryArm,
      armB: other.expressed.secondaryArm,
      birthA: organism.birthConditions,
      birthB: other.birthConditions,
      bendA: organism.expressed.curvature,
      bendB: other.expressed.curvature,
    });
  }

  const within: number[] = [];
  const organisms = worldA.organisms;
  for (let i = 0; i < organisms.length; i++) {
    for (let j = i + 1; j < organisms.length; j++) {
      within.push(channelDistance(organisms[i].expressed, organisms[j].expressed));
    }
  }

  return {
    rows,
    finalA: worldA.conditions,
    finalB: worldB.conditions,
    finalsDiffer: !conditionsClose(worldA.conditions, worldB.conditions, 1e-6),
    medianCross: median(rows.map((row) => row.cross)),
    medianWithinA: median(within),
    maxPlacement: rows.reduce((max, row) => Math.max(max, row.placement), 0),
    armMismatches: rows.filter((row) => row.armA !== row.armB).length,
    subjectId,
    trajectoryA: worldA.trajectory,
    trajectoryB: worldB.trajectory,
  };
}

export function compareOrders(orderA: LogEntry[], orderB: LogEntry[], laws: Laws): CompareReport {
  return compareFolds(foldLog(orderA, laws), foldLog(orderB, laws));
}

export function subjectRow(report: CompareReport): CompareRow | undefined {
  return report.rows.find((row) => row.id === report.subjectId) ?? report.rows[0];
}

/** Same gesture is still nearer than a typical pair of different genomes in World A. */
export function closerThanStranger(report: CompareReport, id = report.subjectId): boolean {
  const row = report.rows.find((item) => item.id === id);
  if (!row) return false;
  return row.cross < report.medianWithinA;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = values.slice().sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function organismIn(world: FoldResult, id: string): Organism | undefined {
  return world.organisms.find((organism) => organism.id === id);
}
