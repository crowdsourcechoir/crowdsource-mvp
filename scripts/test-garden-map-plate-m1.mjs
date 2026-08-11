/**
 * Smoke: M1 map-plate prompt builder (no Runway call).
 * Run: npx tsx scripts/test-garden-map-plate-m1.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const { buildMapPlatePrompt } = await load("lib/song-garden-v2/garden/map-plate.ts");
  const { defaultBrandKit, defaultMapPlate, mergeBrandKit } = await load(
    "lib/song-garden-v2/garden/types.ts"
  );

  const brand = defaultBrandKit({
    title: "Ballard FC",
    primaryColor: "#0B1F3A",
    accentColor: "#CFFF81",
    zones: [
      { key: "supporters", label: "Supporters", x: 0.8, y: 0.2 },
      { key: "beer-garden", label: "Beer Garden", x: 0.9, y: 0.4 },
    ],
  });

  const prompt = buildMapPlatePrompt({
    brand,
    zones: brand.zones,
    vibePrompt: "Interbay night matchday, navy + chartreuse",
    referenceTags: ["ref1"],
  });

  assert.ok(prompt.includes("Ballard FC"), "prompt names the club");
  assert.ok(prompt.includes("Supporters"), "prompt lists zones");
  assert.ok(prompt.includes("@ref1"), "prompt references Runway tags");
  assert.ok(prompt.length <= 1000, "prompt fits Runway limit");

  const merged = mergeBrandKit(brand, {
    mapPlate: {
      draftUrl: "https://example.com/draft.jpg",
      draftGeneratedAt: "2026-01-01T00:00:00Z",
    },
  });
  assert.equal(merged.mapPlate.draftUrl, "https://example.com/draft.jpg");
  assert.deepEqual(
    merged.zones.map((z) => z.key),
    ["supporters", "beer-garden"]
  );
  assert.equal(merged.heroArtworkUrl, null, "generate path must not auto-pin");

  const plate = defaultMapPlate({
    referenceUrls: [" a ", "", "b"],
    vibePrompt: "  hi  ",
  });
  assert.deepEqual(plate.referenceUrls, ["a", "b"]);
  assert.equal(plate.vibePrompt, "hi");

  console.log("ok — map plate M1 prompt + mergeBrandKit");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
