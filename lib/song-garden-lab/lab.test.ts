import assert from "node:assert/strict";
import { depositOf } from "./conditions";
import { expressChannels } from "./express";
import { foldEvents, foldLog } from "./fold";
import { haltonGenomes } from "./genomes";
import { realizeRibbon } from "./grammar";
import { ribbonHash } from "./hash";
import { defaultLaws, syntheticGenome, zeroConditions } from "./laws";
import { quantize01 } from "./quantize";
import { RULES_VERSION, type LabEvent } from "./types";

function hashOf(genome: ReturnType<typeof syntheticGenome>, birth = zeroConditions(), laws = defaultLaws()) {
  const expressed = expressChannels(genome, birth, laws);
  return ribbonHash(realizeRibbon(genome, expressed, laws));
}

function planted(id: string, genome: ReturnType<typeof syntheticGenome>): LabEvent {
  return {
    id,
    index: 0,
    type: "contribution.planted",
    rulesVersion: RULES_VERSION,
    at: "",
    payload: {
      genome,
      genomeId: id,
      birthConditions: zeroConditions(),
      deposit: zeroConditions(),
      position: { x: 0, y: 0 },
    },
  };
}

function main() {
  assert.equal(quantize01(0.5), 32 / 63);
  assert.equal(quantize01(0), 0);
  assert.equal(quantize01(1), 1);

  const quiet = syntheticGenome({ force: 0.1, sustain: 0.2, motion: 0.8, articulation: 0.2, brightness: 0.4, stillness: 0.3 });
  assert.equal(hashOf(quiet), hashOf(quiet), "same germination hashes the same");
  assert.notEqual(
    hashOf(quiet, { density: 0, pulse: 0, tension: 1 }, defaultLaws({ coupling: 1 })),
    hashOf(quiet, zeroConditions(), defaultLaws({ coupling: 1 })),
    "birth tension bends a quiet genome"
  );
  assert.equal(
    hashOf(quiet, { density: 0, pulse: 0, tension: 1 }, defaultLaws({ coupling: 0 })),
    hashOf(quiet, zeroConditions(), defaultLaws({ coupling: 0 })),
    "coupling 0 ignores conditions"
  );
  assert.equal(
    hashOf(quiet, zeroConditions(), defaultLaws({ coupling: 1 })),
    hashOf(quiet, zeroConditions(), defaultLaws({ coupling: 0 })),
    "zero conditions are a pure genome even at full coupling"
  );

  const calm = expressChannels(quiet, zeroConditions(), defaultLaws());
  const tense = expressChannels(quiet, { density: 0, pulse: 0, tension: 1 }, defaultLaws({ coupling: 1 }));
  const tenseToggle = expressChannels(
    quiet,
    { density: 0, pulse: 0, tension: 1 },
    defaultLaws({ coupling: 1, branchFromTension: true })
  );
  assert.equal(calm.secondaryArm, false);
  assert.equal(tense.secondaryArm, false, "tension does not add an arm unless the law says so");
  assert.equal(tenseToggle.secondaryArm, true);
  assert.ok(tense.curvature > calm.curvature);

  const loud = syntheticGenome({ force: 1, sustain: 1, motion: 0.9, articulation: 0.2 });
  const loudCalm = expressChannels(loud, zeroConditions(), defaultLaws({ coupling: 1 }));
  const loudTense = expressChannels(loud, { density: 0, pulse: 0, tension: 1 }, defaultLaws({ coupling: 1 }));
  assert.equal(loudCalm.effectiveCoupling, 0);
  assert.equal(loudTense.curvature, loudCalm.curvature, "a held shout resists the garden");

  const a = syntheticGenome({ motion: 1, articulation: 0, force: 0.2, sustain: 0.2, stillness: 0 });
  const b = syntheticGenome({ motion: 0, articulation: 1, force: 0.2, sustain: 0.2, stillness: 0 });
  const laws = defaultLaws();
  const ab = foldLog(
    [
      { id: "a", genome: a },
      { id: "b", genome: b },
    ],
    laws
  );
  const ba = foldLog(
    [
      { id: "b", genome: b },
      { id: "a", genome: a },
    ],
    laws
  );
  assert.ok(Math.abs(ab.conditions.tension - ba.conditions.tension) > 1e-6, "order changes tension");
  assert.notEqual(ab.organisms[0].id, ba.organisms[0].id);

  const deposit = depositOf(syntheticGenome({ sustain: 1, stillness: 0, force: 1, articulation: 1, motion: 1 }), zeroConditions(), laws);
  assert.ok(Math.abs(deposit.density - 0.08) < 1e-9);
  assert.ok(Math.abs(deposit.pulse - 0.08) < 1e-9);
  assert.ok(Math.abs(deposit.tension - 0.08) < 1e-9);

  const sheet = haltonGenomes(30);
  assert.equal(sheet.length, 30);
  assert.equal(sheet[3].id, "h04");
  assert.equal(new Set(sheet.map((item) => item.id)).size, 30);
  for (const item of sheet) {
    for (const value of [item.genome.force, item.genome.sustain, item.genome.motion]) {
      const steps = Math.round(value * 63);
      assert.ok(Math.abs(value - steps / 63) < 1e-9);
    }
  }

  const field = foldLog(haltonGenomes(12), defaultLaws({ coupling: 0.5 }));
  assert.equal(field.organisms.length, 12);
  assert.equal(field.warnings.length, 0);
  assert.equal(field.organisms[0].birthConditions.density, 0);
  assert.ok(field.organisms[11].birthConditions.density > 0);

  const composted = foldEvents(
    [
      planted("a", a),
      planted("b", b),
      {
        id: "c1",
        index: 2,
        type: "compost",
        rulesVersion: RULES_VERSION,
        at: "",
        payload: { organismId: "a", returns: { density: 0.02, pulse: 0, tension: 0 } },
      },
      { id: "mystery", index: 3, type: "bloom", rulesVersion: RULES_VERSION, at: "", payload: {} },
    ],
    laws
  );
  assert.deepEqual(
    composted.organisms.map((organism) => organism.id),
    ["b"]
  );
  assert.ok(composted.warnings.some((warning) => warning.includes("bloom")));

  console.log("song-garden-lab tests: ok");
}

main();
