/**
 * Smoke: automatic name gate removed; name only via journey config.
 * Run: node scripts/test-no-auto-name-gate.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function src(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

async function main() {
  const world = src("components/song-garden-v2/WorldJourney.tsx");
  assert.doesNotMatch(world, /needsNameGate/);
  assert.doesNotMatch(world, /What name should we credit on your sounds\?/);
  assert.doesNotMatch(world, /nameGateValue/);
  // Explicit journey name steps still store the name when answered.
  assert.match(world, /isNameStep/);
  assert.match(world, /setSonggardenContributorName/);

  const journey = src("components/participant-journey/ParticipantJourney.tsx");
  assert.doesNotMatch(journey, /nameGate/);
  assert.doesNotMatch(journey, /What name should we credit on your sounds\?/);
  assert.doesNotMatch(journey, /handleNameGateContinue/);

  console.log("ok — automatic name gate removed from World + Participant journeys");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
