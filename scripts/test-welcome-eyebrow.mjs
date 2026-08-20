/**
 * Smoke: welcome eyebrow is editable and preserved through Song Garden config.
 * Run: npx tsx scripts/test-welcome-eyebrow.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const { normalizeSongGardenConfig, defaultSongGardenConfig } = await load("lib/songgarden/config.ts");
  const { WELCOME_MOMENT_LABEL } = await load("lib/song-garden-v2/moment-labels.ts");

  const withWelcome = normalizeSongGardenConfig({
    ...defaultSongGardenConfig(),
    welcomeEyebrow: "Welcome to the Zag Song Garden",
    completionEyebrow: "Thank you!",
  });
  assert.equal(withWelcome.welcomeEyebrow, "Welcome to the Zag Song Garden");
  assert.equal(withWelcome.completionEyebrow, "Thank you!");

  const blank = normalizeSongGardenConfig(defaultSongGardenConfig());
  assert.equal(blank.welcomeEyebrow, undefined);

  const form = readFileSync(path.join(process.cwd(), "components/EventForm.tsx"), "utf8");
  assert.match(form, /id="welcomeEyebrow"/);
  assert.match(form, /welcomeEyebrow/);

  const journey = readFileSync(
    path.join(process.cwd(), "components/song-garden-v2/WorldJourney.tsx"),
    "utf8"
  );
  assert.match(journey, /welcomeEyebrow/);
  assert.match(journey, /songGardenConfig\?\.welcomeEyebrow/);
  assert.ok(WELCOME_MOMENT_LABEL.length > 0);

  console.log("ok — welcome eyebrow editable + preserved");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
