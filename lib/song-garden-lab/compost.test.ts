import assert from "node:assert/strict";
import { scaleConditions, foldSteps, type LogStep } from "./compost";
import { depositOf } from "./conditions";
import { defaultLaws, syntheticGenome, zeroConditions } from "./laws";
import { ribbonHash } from "./hash";

function plant(id: string, genome: ReturnType<typeof syntheticGenome>): LogStep {
  return { id, type: "contribution.planted", genome };
}

function main() {
  const laws = defaultLaws({ compostFraction: 0.5 });
  const loud = syntheticGenome({ sustain: 1, stillness: 0, force: 1, articulation: 1, motion: 1 });
  const deposit = depositOf(loud, zeroConditions(), laws);
  assert.ok(Math.abs(deposit.density - 0.08) < 1e-9);

  const returns = scaleConditions(deposit, 0.5);
  assert.ok(Math.abs(returns.density - 0.04) < 1e-9);

  const kept = foldSteps([plant("a", loud)], laws);
  const returned = foldSteps(
    [plant("a", loud), { id: "return-a", type: "compost", organismId: "a", returns }],
    laws
  );
  assert.deepEqual(
    returned.organisms.map((organism) => organism.id),
    []
  );
  assert.equal(returned.remnants.length, 1);
  assert.equal(returned.remnants[0].id, "a");
  assert.equal(ribbonHash(returned.remnants[0].ribbon), ribbonHash(kept.organisms[0].ribbon));
  assert.ok(returned.conditions.density > kept.conditions.density, "a return adds material, it does not refund the planting");
  assert.ok(returned.conditions.density < 0.2);
  assert.ok(Math.abs(returned.conditions.density - (0.08 + 0.04 * 0.92)) < 1e-9);

  const none = scaleConditions(deposit, 0);
  const untouched = foldSteps(
    [plant("a", loud), { id: "return-a", type: "compost", organismId: "a", returns: none }],
    laws
  );
  assert.ok(Math.abs(untouched.conditions.density - kept.conditions.density) < 1e-9);

  const quiet = syntheticGenome({ motion: 1, articulation: 0, force: 0.2, sustain: 0.2, stillness: 0 });
  const busy = syntheticGenome({ motion: 0, articulation: 1, force: 0.2, sustain: 0.2, stillness: 0 });
  const quietDeposit = depositOf(quiet, zeroConditions(), laws);
  const early = foldSteps(
    [
      plant("a", quiet),
      { id: "return-a", type: "compost", organismId: "a", returns: scaleConditions(quietDeposit, 0.5) },
      plant("b", busy),
    ],
    laws
  );
  const late = foldSteps(
    [
      plant("a", quiet),
      plant("b", busy),
      { id: "return-a", type: "compost", organismId: "a", returns: scaleConditions(quietDeposit, 0.5) },
    ],
    laws
  );
  assert.deepEqual(
    early.organisms.map((organism) => organism.id),
    ["b"]
  );
  assert.deepEqual(
    late.organisms.map((organism) => organism.id),
    ["b"]
  );
  assert.ok(
    Math.abs(early.organisms[0].birthConditions.tension - late.organisms[0].birthConditions.tension) > 1e-6,
    "returning before the next planting changes that birth"
  );
  assert.equal(early.warnings.length, 0);

  const missing = foldSteps([{ id: "return-z", type: "compost", organismId: "z", returns: none }], laws);
  assert.ok(missing.warnings.some((warning) => warning.includes("z")));
  assert.equal(missing.remnants.length, 0);

  const log: LogStep[] = [plant("a", loud)];
  foldSteps([...log, { id: "return-a", type: "compost", organismId: "a", returns }], laws);
  assert.equal(log.length, 1, "the fold does not delete the planting");

  console.log("song-garden-lab compost tests: ok");
}

main();
