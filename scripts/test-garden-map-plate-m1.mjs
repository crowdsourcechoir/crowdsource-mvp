/**
 * Smoke: M1–M4 map-plate helpers (no Runway call).
 * Run: npx tsx scripts/test-garden-map-plate-m1.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const { buildMapPlatePrompt, buildLayoutGuideClause } = await load(
    "lib/song-garden-v2/garden/map-plate.ts"
  );
  const { buildLayoutSchematicPng } = await load(
    "lib/song-garden-v2/garden/layout-schematic.ts"
  );
  const {
    defaultBrandKit,
    defaultMapPlate,
    mergeBrandKit,
    resolveMapPlateStillUrl,
    resolveMapPlateVideoUrl,
  } = await load("lib/song-garden-v2/garden/types.ts");

  const brand = defaultBrandKit({
    title: "Ballard FC",
    primaryColor: "#0B1F3A",
    accentColor: "#CFFF81",
    heroArtworkUrl: "/fans/ballard-fc/interbay-stadium-map.jpg",
    zones: [
      { key: "supporters", label: "Supporters", x: 0.8, y: 0.2 },
      { key: "beer-garden", label: "Beer Garden", x: 0.9, y: 0.4 },
    ],
  });

  const layoutClause = buildLayoutGuideClause(brand.zones);
  assert.ok(layoutClause.includes("80%"), "layout clause uses percent X");
  assert.ok(layoutClause.includes("Supporters"), "layout clause names zones");

  const prompt = buildMapPlatePrompt({
    brand,
    zones: brand.zones,
    vibePrompt: "Interbay night matchday, navy + chartreuse",
    referenceTags: ["layout", "ref1"],
    layoutGuided: true,
  });

  assert.ok(prompt.includes("Ballard FC"), "prompt names the club");
  assert.ok(prompt.includes("@layout"), "prompt references layout tag");
  assert.ok(prompt.includes("80%"), "prompt includes layout percents");
  assert.ok(prompt.length <= 1000, "prompt fits Runway limit");

  const png = buildLayoutSchematicPng({
    zones: brand.zones,
    primaryColor: brand.primaryColor,
    accentColor: brand.accentColor,
  });
  assert.ok(png.length > 200, "schematic PNG has bytes");
  assert.equal(png[0], 0x89, "PNG signature");

  const merged = mergeBrandKit(brand, {
    mapPlate: {
      draftUrl: "https://example.com/draft.jpg",
      draftGeneratedAt: "2026-01-01T00:00:00Z",
      layoutGuided: true,
      ambientVideoUrl: "https://example.com/ambient.mp4",
      variants: [
        {
          key: "goal",
          label: "Goal roar",
          stillUrl: "https://example.com/goal.jpg",
          videoUrl: null,
          generatedAt: "2026-01-02T00:00:00Z",
        },
      ],
      activeVariantKey: "goal",
    },
  });
  assert.equal(merged.mapPlate.layoutGuided, true);
  assert.equal(merged.mapPlate.variants.length, 1);
  assert.equal(resolveMapPlateStillUrl(merged), "https://example.com/goal.jpg");
  assert.equal(resolveMapPlateVideoUrl(merged), "https://example.com/ambient.mp4");

  const plate = defaultMapPlate({
    referenceUrls: [" a ", "", "b"],
    vibePrompt: "  hi  ",
  });
  assert.deepEqual(plate.referenceUrls, ["a", "b"]);
  assert.equal(plate.vibePrompt, "hi");
  assert.equal(plate.layoutGuided, false);
  assert.deepEqual(plate.variants, []);

  console.log("ok — map plate M1–M4 prompt, layout schematic, resolve URLs");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
