import {
  defaultMutationPolicy,
  emptyWorldState,
  type ContributionKind,
  type MutationPolicy,
  type SharedGrowthNode,
  type WorldEffect,
  type WorldMutationIntent,
  type WorldState,
} from "./types";

export type ApplyMutationResult = {
  nextState: WorldState;
  effects: WorldEffect[];
  delta: Record<string, unknown>;
  markIndex: number;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function deviceDampingFactor(
  policy: MutationPolicy,
  recentAts: string[] | undefined,
  nowMs: number
): number {
  const windowMs = policy.deviceDamping.windowMinutes * 60_000;
  const recent = (recentAts ?? []).filter((iso) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) && nowMs - t <= windowMs;
  });
  if (recent.length >= policy.deviceDamping.afterCount) {
    return policy.deviceDamping.factor;
  }
  return 1;
}

function compactField(nodes: SharedGrowthNode[], maxNodes: number): SharedGrowthNode[] {
  if (nodes.length <= maxNodes) return nodes;
  // Keep the newest maxNodes entries; older mass is already in layers/energy.
  return nodes.slice(nodes.length - maxNodes);
}

/**
 * Pure mutation engine — server applies this, then persists.
 * `world_version` on the garden row is the authority; state.version mirrors it after persist.
 */
export function applyMutation(
  prev: WorldState | null | undefined,
  intent: WorldMutationIntent,
  policyInput?: Partial<MutationPolicy> | null,
  now = new Date()
): ApplyMutationResult {
  const policy = defaultMutationPolicy(policyInput ?? undefined);
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const base =
    prev && typeof prev === "object"
      ? structuredClone(prev)
      : emptyWorldState(`garden_${intent.gardenId.slice(0, 8)}`);

  // Ensure layer keys exist (older blobs / partial JSON).
  for (const kind of [
    "text",
    "voice",
    "video",
    "percussion",
    "vocal",
    "other",
  ] as ContributionKind[]) {
    if (typeof base.layers[kind] !== "number") base.layers[kind] = 0;
  }
  if (!base.field) base.field = { nodes: [], nextIndex: 0 };
  if (!Array.isArray(base.field.nodes)) base.field.nodes = [];
  if (!Array.isArray(base.landmarks)) base.landmarks = [];
  if (!base.totals) base.totals = { contributions: 0, participants: 0, byKind: {} };
  if (!base.chapters) base.chapters = { completedIds: [], activeChapterId: null };

  const chapterWeight =
    typeof intent.chapterWeight === "number" && Number.isFinite(intent.chapterWeight)
      ? intent.chapterWeight
      : policy.chapterWeightDefault;
  const damp = deviceDampingFactor(policy, intent.recentDeviceMutationAts, nowMs);
  const w = chapterWeight * damp;

  const energyDelta = policy.energyPerContribution * w;
  const prevEnergy = clamp01(Number(base.energy) || 0);
  const nextEnergy = Math.min(policy.energyCap, prevEnergy + energyDelta);

  const prevLayer = clamp01(Number(base.layers[intent.kind]) || 0);
  const nextLayer = Math.min(policy.layerCap, prevLayer + policy.layerGain * w);

  const markIndex = base.field.nextIndex;
  const node: SharedGrowthNode = {
    id: `n_${nowMs.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    kind: intent.kind,
    index: markIndex,
    weight: policy.nodeWeight * w,
    chapterId: intent.chapterId,
    createdAt: nowIso,
  };

  base.field.nodes = compactField([...base.field.nodes, node], policy.maxNodes);
  base.field.nextIndex = markIndex + 1;
  base.energy = nextEnergy;
  base.layers[intent.kind] = nextLayer;
  base.totals.contributions = (base.totals.contributions || 0) + 1;
  base.totals.byKind[intent.kind] = (base.totals.byKind[intent.kind] || 0) + 1;
  if (intent.chapterId) {
    base.chapters.activeChapterId = intent.chapterId;
  }
  base.updatedAt = nowIso;
  base.version = (Number(base.version) || 0) + 1;

  const effects: WorldEffect[] = [
    { type: "energy_up", delta: energyDelta },
    { type: "layer_up", kind: intent.kind, level: nextLayer },
  ];

  const unlockedKeys = new Set(base.landmarks.map((l) => l.key));
  for (const rule of policy.landmarks) {
    if (unlockedKeys.has(rule.key)) continue;
    const energyOk =
      rule.minEnergy == null || nextEnergy + 1e-9 >= rule.minEnergy;
    const contribOk =
      rule.minContributions == null ||
      base.totals.contributions >= rule.minContributions;
    const chapterOk =
      rule.minChapterIndex == null ||
      (typeof intent.chapterIndex === "number" &&
        intent.chapterIndex >= rule.minChapterIndex);
    if (energyOk && contribOk && chapterOk) {
      base.landmarks.push({
        id: `lm_${rule.key}_${nowMs.toString(36)}`,
        key: rule.key,
        label: rule.label,
        unlockedAt: nowIso,
        unlockedBy: "threshold",
      });
      unlockedKeys.add(rule.key);
      effects.push({
        type: "landmark_unlocked",
        key: rule.key,
        label: rule.label,
      });
    }
  }

  return {
    nextState: base,
    effects,
    delta: {
      energyDelta,
      layerKind: intent.kind,
      layerGain: nextLayer - prevLayer,
      weight: w,
      damping: damp,
      nodeId: node.id,
    },
    markIndex,
  };
}
