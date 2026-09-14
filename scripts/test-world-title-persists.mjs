/**
 * World title stays on bloom journey chrome after garden snapshot / permissions.
 * Run: npx tsx scripts/test-world-title-persists.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const { resolveWorldConfig } = await load("lib/song-garden-v2/world-config.ts");
  const { worldConfigFromBrand } = await load("lib/song-garden-v2/garden/snapshot.ts");
  const { defaultBrandKit } = await load("lib/song-garden-v2/garden/types.ts");

  const eventWorld = resolveWorldConfig({
    title: "WFEA Song Garden",
    heroImage: "",
    worldConfig: { title: "Crowdsource Choir" },
  });
  assert.equal(eventWorld.title, "Crowdsource Choir");

  const gardenBrand = defaultBrandKit({ title: "WFEA Song Garden" });
  const bloom = worldConfigFromBrand(gardenBrand, eventWorld, { persistFallbackTitle: true });
  assert.equal(bloom.title, "Crowdsource Choir");

  const gardenPage = worldConfigFromBrand(gardenBrand, eventWorld);
  assert.equal(gardenPage.title, "WFEA Song Garden");

  const journey = readFileSync(
    path.join(process.cwd(), "components/song-garden-v2/WorldJourney.tsx"),
    "utf8"
  );
  assert.match(journey, /persistFallbackTitle:\s*true/);
  assert.match(journey, /\{world\.title\}/);

  const form = readFileSync(path.join(process.cwd(), "components/EventForm.tsx"), "utf8");
  assert.match(form, /Stays at the top of the public journey/);

  console.log("ok — world title persists on bloom journey");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
