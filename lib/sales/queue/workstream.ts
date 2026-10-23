import {
  WORKSTREAM_KEYS,
  WORKSTREAMS,
  classifyWorkstream,
  type WorkstreamClassifyInput,
  type WorkstreamKey,
} from "../strategy/playbook";

export type QueueWorkstreamFilter = "all" | WorkstreamKey;

export const QUEUE_WORKSTREAM_OPTIONS: { key: QueueWorkstreamFilter; label: string }[] = [
  { key: "all", label: "All work" },
  ...WORKSTREAM_KEYS.map((key) => ({
    key,
    label: `${WORKSTREAMS[key].shortLabel} ${WORKSTREAMS[key].effortPct}%`,
  })),
];

export function parseQueueWorkstream(raw: string | null | undefined): QueueWorkstreamFilter {
  if (!raw || raw === "all") return "all";
  return (WORKSTREAM_KEYS as readonly string[]).includes(raw) ? (raw as WorkstreamKey) : "all";
}

export function matchesQueueWorkstream(
  input: WorkstreamClassifyInput & { workstream?: WorkstreamKey | null },
  filter: QueueWorkstreamFilter
): boolean {
  if (filter === "all") return true;
  const key = input.workstream ?? classifyWorkstream(input);
  return key === filter;
}

export function countQueueWorkstreams<T extends WorkstreamClassifyInput & { workstream?: WorkstreamKey | null }>(
  items: T[]
): Record<QueueWorkstreamFilter, number> {
  const counts: Record<QueueWorkstreamFilter, number> = {
    all: items.length,
    premium: 0,
    partnership: 0,
    sponsor: 0,
    owned: 0,
  };
  for (const item of items) {
    const key = item.workstream ?? classifyWorkstream(item);
    counts[key] += 1;
  }
  return counts;
}
