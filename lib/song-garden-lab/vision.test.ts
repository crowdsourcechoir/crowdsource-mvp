import assert from "node:assert/strict";
import { genomeKey } from "./quantize";
import { ribbonHash } from "./hash";
import { realizeRibbon } from "./grammar";
import { expressChannels } from "./express";
import { defaultLaws, zeroConditions } from "./laws";
import { depositOf } from "./conditions";
import { organismFrom } from "./fold";
import { analyzeFrames, testPicture } from "./vision";
import { ignoredLanguage, languageFromModel, usedAxes } from "./language";

function main() {
  const flat = analyzeFrames(testPicture("flat").frames, true);
  assert.equal(flat.motionSource, "still");
  assert.equal(flat.genome.motion, 0);
  assert.equal(flat.genome.articulation, 0);
  assert.equal(flat.genome.sustain, 0);
  assert.equal(flat.genome.register, 0.5);
  assert.ok(Math.abs(flat.axes.brightness.normalized - 0.5) < 0.02);

  const checker = analyzeFrames(testPicture("checker").frames, true);
  assert.equal(checker.motionSource, "still");
  assert.equal(checker.genome.motion, 0);
  assert.equal(checker.genome.sustain, 1);
  assert.ok(checker.genome.force > 0.9, `checker force ${checker.genome.force}`);
  assert.equal(genomeKey(checker.genome), genomeKey(analyzeFrames(testPicture("checker").frames, true).genome));

  const blink = analyzeFrames(testPicture("blink").frames, false);
  assert.equal(blink.motionSource, "flow");
  assert.ok(blink.genome.motion > 0.9, `blink motion ${blink.genome.motion}`);
  assert.ok(blink.onsets >= 8, `blink onsets ${blink.onsets}`);
  assert.ok(blink.genome.articulation > 0);
  assert.equal(blink.genome.sustain, 0, "flat frames have no held contrast");

  const laws = defaultLaws();
  const origin = zeroConditions();
  const body = organismFrom("seen", checker.genome, origin, depositOf(checker.genome, origin, laws), [], laws);
  const hash = ribbonHash(body.ribbon);
  const again = ribbonHash(realizeRibbon(checker.genome, expressChannels(checker.genome, origin, laws), laws));
  assert.equal(hash, again);

  const unused = ignoredLanguage("for the people who arrive later", false);
  assert.equal(unused.available, false);
  assert.deepEqual(usedAxes(unused), []);

  const wild = languageFromModel(
    "stay",
    { hold: 4, outward: -2, weight: "nope", confidence: { hold: 0.9, outward: 0.1, weight: 2 } },
    true
  );
  assert.equal(wild.hold.value, 1);
  assert.equal(wild.outward.value, 0);
  assert.equal(wild.weight.value, 0);
  assert.equal(wild.weight.confidence, 1);
  assert.deepEqual(usedAxes(wild), ["hold", "weight"]);
  assert.equal(wild.outward.confidence < 0.5, true);

  const empty = languageFromModel("x", null, true);
  assert.deepEqual(usedAxes(empty), []);

  console.log("song-garden-lab vision tests: ok");
}

main();
