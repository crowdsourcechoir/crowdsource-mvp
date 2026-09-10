/**
 * Regression: multi-channel journey prompts must stay on one card —
 * helper text on the chooser, Type/Record expand inline (no second prompt).
 * Run: npx tsx scripts/test-journey-inline-channel-card.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const world = readFileSync(join(root, "components/song-garden-v2/WorldJourney.tsx"), "utf8");
const textPad = readFileSync(join(root, "components/song-garden-v2/TextMomentPad.tsx"), "utf8");
const soundPad = readFileSync(join(root, "components/song-garden-v2/SoundMomentPad.tsx"), "utf8");

assert.match(world, /One card: question \+ helper stay put/, "WorldJourney must document single-card channel UX");
assert.match(world, /availableChannels\.length > 0/, "step card mounts whenever channels exist");
assert.equal(
  /showChannelChooser &&/.test(world),
  false,
  "must not gate the first view behind a separate chooser-only branch"
);
assert.match(world, /hidePrompt/, "pads must hide duplicate prompt on shared card");
assert.match(world, /hideHint/, "pads must hide duplicate hint on shared card");
assert.match(world, /autoStart=\{availableChannels\.length > 1\}/, "Record from chooser should auto-start capture");
assert.match(textPad, /hidePrompt\?:/, "TextMomentPad supports hidePrompt");
assert.match(soundPad, /autoStart\?:/, "SoundMomentPad supports autoStart");
assert.match(soundPad, /hidePrompt\?:/, "SoundMomentPad supports hidePrompt");

console.log("journey inline channel card regression passed");
