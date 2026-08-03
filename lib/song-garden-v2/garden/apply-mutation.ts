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
  const damp =
    typeof intent.forcedWeight === "number" && Number.isFinite(intent.forcedWeight)
      ? 1
      : deviceDampingFactor(policy, intent.recentDeviceMutationAts, nowMs);
  const w =
    typeof intent.forcedWeight === "number" && Number.isFinite(intent.forcedWeight)
      ? intent.forcedWeight
      : chapterWeight * damp;

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

/**
 * Chapter finale — closes the ritual with a heavier bloom and a chapter landmark.
 */
export function applyChapterFinale(
  prev: WorldState | null | undefined,
  args: {
    gardenId: string;
    chapterId: string;
    chapterIndex: number;
    chapterLabel: string;
    finaleWeight?: number;
  },
  policyInput?: Partial<MutationPolicy> | null,
  now = new Date()
): ApplyMutationResult {
  const policy = defaultMutationPolicy(policyInput ?? undefined);
  const finaleWeight = args.finaleWeight ?? policy.chapterFinaleWeight;
  const applied = applyMutation(
    prev,
    {
      gardenId: args.gardenId,
      chapterId: args.chapterId,
      kind: "other",
      sourceType: "finale",
      sourceId: `finale_${args.chapterId}`,
      deviceId: null,
      chapterIndex: args.chapterIndex,
      forcedWeight: finaleWeight,
    },
    policy,
    now
  );

  const state = applied.nextState;
  const nowIso = state.updatedAt;
  const landmarkKey = `chapter_${args.chapterIndex}`;
  const landmarkLabel = `${args.chapterLabel || `Show ${args.chapterIndex}`} sealed`;
  const effects = [...applied.effects];

  if (!state.chapters.completedIds.includes(args.chapterId)) {
    state.chapters.completedIds = [...state.chapters.completedIds, args.chapterId];
  }
  state.chapters.activeChapterId = null;

  if (!state.landmarks.some((l) => l.key === landmarkKey)) {
    state.landmarks.push({
      id: `lm_${landmarkKey}_${Date.now().toString(36)}`,
      key: landmarkKey,
      label: landmarkLabel,
      unlockedAt: nowIso,
      unlockedBy: "chapter",
    });
    effects.push({
      type: "landmark_unlocked",
      key: landmarkKey,
      label: landmarkLabel,
    });
  }
  effects.push({ type: "chapter_bloom", chapterId: args.chapterId });

  return {
    nextState: state,
    effects,
    delta: {
      ...applied.delta,
      finale: true,
      chapterId: args.chapterId,
      chapterIndex: args.chapterIndex,
    },
    markIndex: applied.markIndex,
  };
}

/** Rebuild world state by replaying mutations up to (and including) a cutoff. */
export function replayMutationsToState(args: {
  gardenId: string;
  renderSeed: string;
  policy: MutationPolicy;
  mutations: Array<{
    chapterId: string | null;
    deviceId: string | null;
    kind: ContributionKind;
    sourceType: WorldMutationIntent["sourceType"];
    sourceId: string;
    delta: Record<string, unknown>;
    effects: WorldEffect[];
    createdAt: string;
  }>;
}): WorldState {
  let state = emptyWorldState(args.renderSeed);
  const deviceAts = new Map<string, string[]>();

  for (const mut of args.mutations) {
    // Finale mutations are reconstructed from stored delta/effects when possible.
    if (mut.sourceType === "finale") {
      const chapterId = mut.chapterId;
      const chapterIndex =
        typeof mut.delta.chapterIndex === "number" ? mut.delta.chapterIndex : 1;
      const unlocked = mut.effects.find((e) => e.type === "landmark_unlocked");
      const label =
        unlocked && unlocked.type === "landmark_unlocked"
          ? unlocked.label.replace(/ sealed$/, "")
          : `Show ${chapterIndex}`;
      if (chapterId) {
        const finale = applyChapterFinale(
          state,
          {
            gardenId: args.gardenId,
            chapterId,
            chapterIndex,
            chapterLabel: label,
            finaleWeight:
              typeof mut.delta.weight === "number" ? Number(mut.delta.weight) : undefined,
          },
          args.policy,
          new Date(mut.createdAt)
        );
        state = finale.nextState;
        continue;
      }
    }

    const recent = mut.deviceId ? deviceAts.get(mut.deviceId) ?? [] : [];
    const forced =
      typeof mut.delta.weight === "number" ? Number(mut.delta.weight) : undefined;
    const applied = applyMutation(
      state,
      {
        gardenId: args.gardenId,
        chapterId: mut.chapterId,
        kind: mut.kind,
        sourceType: mut.sourceType,
        sourceId: mut.sourceId,
        deviceId: mut.deviceId,
        forcedWeight: forced,
        recentDeviceMutationAts: recent,
      },
      args.policy,
      new Date(mut.createdAt)
    );
    state = applied.nextState;
    if (mut.deviceId) {
      const next = [...(deviceAts.get(mut.deviceId) ?? []), mut.createdAt];
      deviceAts.set(mut.deviceId, next.slice(-20));
    }
  }
  return state;
}
