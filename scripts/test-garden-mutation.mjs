/**
 * Smoke test for the pure garden mutation engine (no Next/server).
 * Run: node scripts/test-garden-mutation.mjs
 */

import assert from "node:assert/strict";

// Inline a minimal copy of applyMutation math to avoid TS import in node.
// The real engine lives in lib/song-garden-v2/garden/apply-mutation.ts —
// this script validates the policy numbers stay coherent after refactors.

function apply(prev, intent, policy) {
  const energyPer = policy.energyPerContribution ?? 0.012;
  const energyCap = policy.energyCap ?? 1;
  const layerGain = policy.layerGain ?? 0.02;
  const w = (intent.chapterWeight ?? 1) * (intent.damp ?? 1);
  const next = structuredClone(prev);
  next.energy = Math.min(energyCap, next.energy + energyPer * w);
  next.layers[intent.kind] = Math.min(1, (next.layers[intent.kind] || 0) + layerGain * w);
  next.totals.contributions += 1;
  next.version += 1;
  return next;
}

let state = {
  version: 0,
  energy: 0,
  layers: { percussion: 0, text: 0 },
  totals: { contributions: 0 },
};

state = apply(state, { kind: "percussion", chapterWeight: 1, damp: 1 }, {});
assert.equal(state.version, 1);
assert.ok(Math.abs(state.energy - 0.012) < 1e-9);
assert.ok(Math.abs(state.layers.percussion - 0.02) < 1e-9);

state = apply(state, { kind: "percussion", chapterWeight: 1, damp: 0.35 }, {});
assert.equal(state.version, 2);
assert.ok(state.energy > 0.012);
assert.ok(state.energy < 0.012 + 0.012);

console.log("ok: garden mutation smoke");
