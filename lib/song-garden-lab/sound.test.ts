import assert from "node:assert/strict";
import { foldSteps, type LogStep } from "./compost";
import { defaultLaws, syntheticGenome, zeroConditions } from "./laws";
import { midiToHz, noteName, sounding } from "./sound";
import type { Conditions, Organism } from "./types";

function body(id: string, register: number, conditions: Conditions = zeroConditions()): Organism {
  const [organism] = foldSteps(
    [{ id, type: "contribution.planted", genome: syntheticGenome({ register }) }],
    defaultLaws()
  ).organisms;
  return organism;
}

function main() {
  const laws = defaultLaws();
  const low = body("low", 0);
  const high = body("high", 1);
  const mid = body("mid", 0.5);
  const full: Conditions = { density: 1, pulse: 1, tension: 1 };

  const spread = sounding([low, high], full, laws);
  assert.ok(Math.abs(spread.voices[0].midi - (60 - 24)) < 1e-9, "register 0 at full tension is C2");
  assert.ok(Math.abs(spread.voices[1].midi - (60 + 24)) < 1e-9, "register 1 at full tension is C6");
  assert.equal(noteName(spread.voices[0].midi), "C2");
  assert.equal(noteName(spread.voices[1].midi), "C6");
  assert.ok(Math.abs(spread.voices[0].hz - midiToHz(36)) < 1e-6);

  const together = sounding([low, high], { density: 0.2, pulse: 0, tension: 0 }, laws);
  assert.ok(Math.abs(together.voices[0].midi - 60) < 1e-9);
  assert.ok(Math.abs(together.voices[1].midi - 60) < 1e-9, "zero tension sits every register on the center");

  const capped = sounding([mid], full, laws);
  assert.ok(Math.abs(capped.thickness - laws.densityCeiling) < 1e-9);
  assert.ok(Math.abs(capped.voices[0].gain - laws.densityCeiling) < 1e-9);
  assert.ok(capped.tempoHz > sounding([mid], zeroConditions(), laws).tempoHz);

  const muted = sounding([low, high], full, defaultLaws({ mute: { density: false, pulse: false, tension: true } }));
  assert.ok(Math.abs(muted.voices[0].midi - 60) < 1e-9);
  assert.ok(Math.abs(muted.voices[1].midi - 60) < 1e-9);

  const silent = sounding([], full, laws);
  assert.equal(silent.voices.length, 0);
  assert.ok(silent.thickness > 0, "the air can be thick with nobody in it");

  const leak = defaultLaws({ leak: { density: 0.5, pulse: 0.5, tension: 0.5 } });
  const planted: LogStep = { id: "a", type: "contribution.planted", genome: syntheticGenome({ sustain: 1, stillness: 0, force: 1 }) };
  const kept = foldSteps([planted], leak);
  const thinned = foldSteps([planted, { id: "t1", type: "tick" }], leak);
  assert.equal(thinned.organisms.length, 1);
  assert.equal(thinned.warnings.length, 0);
  assert.ok(Math.abs(thinned.conditions.density - kept.conditions.density * 0.5) < 1e-9);
  assert.ok(Math.abs(thinned.conditions.pulse - kept.conditions.pulse * 0.5) < 1e-9);
  assert.ok(Math.abs(thinned.conditions.tension - kept.conditions.tension * 0.5) < 1e-9);

  const still = foldSteps([planted, { id: "t1", type: "tick" }], defaultLaws());
  const before = foldSteps([planted], defaultLaws());
  assert.ok(Math.abs(still.conditions.density - before.conditions.density) < 1e-9, "a second with leak 0 changes nothing");

  const early = foldSteps(
    [planted, { id: "t1", type: "tick" }, { id: "b", type: "contribution.planted", genome: syntheticGenome({ motion: 1 }) }],
    leak
  );
  const late = foldSteps(
    [planted, { id: "b", type: "contribution.planted", genome: syntheticGenome({ motion: 1 }) }, { id: "t1", type: "tick" }],
    leak
  );
  assert.ok(
    Math.abs(early.organisms.find((organism) => organism.id === "b")!.birthConditions.tension -
      late.organisms.find((organism) => organism.id === "b")!.birthConditions.tension) > 1e-6,
    "a second before the next planting changes that birth"
  );

  console.log("song-garden-lab sound tests: ok");
}

main();
