/**
 * Atmosphere + Plant a seed smoke (local store).
 * Run: USE_LOCAL_EVENTS=true npx tsx scripts/test-garden-atmosphere.mjs
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const prevCwd = process.cwd();
const tmp = mkdtempSync(path.join(tmpdir(), "atm-"));
process.env.USE_LOCAL_EVENTS = "true";

async function main() {
  process.chdir(tmp);
  mkdirSync(path.join(tmp, ".data"), { recursive: true });
  writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "tmp" }));

  const types = await import(
    pathToFileURL(path.join(prevCwd, "lib/song-garden-v2/garden/types.ts")).href
  );
  const snapshot = await import(
    pathToFileURL(path.join(prevCwd, "lib/song-garden-v2/garden/snapshot.ts")).href
  );
  const worldConfig = await import(
    pathToFileURL(path.join(prevCwd, "lib/song-garden-v2/world-config.ts")).href
  );

  const brand = types.defaultBrandKit({
    title: "Test",
    heroArtworkUrl: null,
  });
  assert.equal(brand.atmosphere.mode, "brand_wash");
  console.log("  ✓ new garden defaults to brand_wash");

  const withHero = types.defaultBrandKit({
    title: "Mapped",
    heroArtworkUrl: "https://example.com/map.jpg",
    mapPlate: { pinnedAt: "2026-01-01T00:00:00.000Z" },
  });
  assert.ok(
    withHero.atmosphere.mode === "map_plate" || withHero.atmosphere.mode === "static_photo"
  );
  console.log("  ✓ legacy hero infers map/static atmosphere");

  const videoBrand = types.mergeBrandKit(brand, {
    atmosphere: {
      mode: "vibe_video",
      videoUrl: "https://example.com/loop.mp4",
      stillUrl: "https://example.com/poster.jpg",
      posterUrl: "https://example.com/poster.jpg",
      vibePrompt: "mist",
    },
  });
  const fallback = worldConfig.defaultWorldConfig({ title: "x", heroImage: null });
  const world = snapshot.worldConfigFromBrand(videoBrand, fallback);
  assert.equal(world.worldStoryboard.length, 1);
  assert.equal(world.worldStoryboard[0].videoUrl, "https://example.com/loop.mp4");
  console.log("  ✓ vibe_video maps to WorldStage storyboard loop");

  const gauss = types.mergeBrandKit(brand, {
    atmosphere: types.defaultAtmosphere({ mode: "gaussian" }),
  });
  const gWorld = snapshot.worldConfigFromBrand(gauss, fallback);
  assert.equal(gWorld.heroArtworkUrl, null);
  assert.equal(gWorld.animationPreset, "aurora");
  console.log("  ✓ gaussian uses aurora stub (no hard photo)");

  console.log("\nAtmosphere checks passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    process.chdir(prevCwd);
    rmSync(tmp, { recursive: true, force: true });
  });
