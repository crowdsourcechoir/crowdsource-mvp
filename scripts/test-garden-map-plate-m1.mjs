/**
 * Smoke: M1–M4 map-plate helpers + digital twin prompt (no Runway call).
 * Run: npx tsx scripts/test-garden-map-plate-m1.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const {
    buildMapPlatePrompt,
    buildLayoutGuideClause,
    buildMapPlateReferences,
    absoluteMediaUrl,
  } = await load("lib/song-garden-v2/garden/map-plate.ts");
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
  assert.ok(
    layoutClause.toLowerCase().includes("unlabeled") || layoutClause.toLowerCase().includes("no words"),
    "layout avoids painted names"
  );
  assert.ok(!layoutClause.includes("Supporters"), "layout omits zone names (they become fake signs)");

  const twinPrompt = buildMapPlatePrompt({
    brand,
    zones: brand.zones,
    vibePrompt: "Interbay night matchday, navy + chartreuse",
    venueNotes: "Horizontal pitch; west parking; north concessions",
    referenceTags: ["venue", "layout"],
    layoutGuided: true,
    twinMode: true,
  });

  assert.ok(twinPrompt.includes("DIGITAL TWIN") || twinPrompt.includes("digital twin"), "twin lock");
  assert.ok(twinPrompt.includes("@venue"), "prompt references venue");
  assert.ok(twinPrompt.toLowerCase().includes("bowl") || twinPrompt.includes("FORBIDDEN"), "anti-bowl");
  assert.ok(twinPrompt.includes("west parking") || twinPrompt.includes("Venue landmarks") || twinPrompt.includes("parking"), "venue notes");
  assert.ok(!twinPrompt.toLowerCase().includes("invent a new song garden map plate rather than copying"), "must not invent-away the venue");
  assert.ok(twinPrompt.includes("TEXT-FREE"), "anti-text lock present");
  assert.ok(twinPrompt.includes("FORBIDDEN"), "anti-bowl survives char budget");
  assert.ok(!twinPrompt.includes("Beer Garden"), "must not list zone labels (drives fake signage)");
  assert.ok(twinPrompt.length <= 1000, "prompt fits Runway limit");

  const inventPrompt = buildMapPlatePrompt({
    brand,
    zones: brand.zones,
    vibePrompt: "fantasy arena",
    referenceTags: ["ref1"],
    twinMode: false,
  });
  assert.ok(inventPrompt.includes("fantasy") || inventPrompt.includes("Ballard"), "invent mode still works");

  const twinRefs = buildMapPlateReferences({
    referenceUrls: ["/fans/ballard-fc/interbay-stadium-map.jpg", "https://example.com/earth.jpg"],
    layoutSchematicUrl: "https://example.com/layout.png",
    layoutGuided: true,
    twinMode: true,
  });
  assert.equal(twinRefs[0].tag, "venue", "twin puts venue first");
  assert.ok(!twinRefs.some((r) => r.tag === "layout"), "twin skips schematic PNG");
  assert.equal(twinRefs[1].tag, "ref2", "second aerial allowed");
  assert.ok(twinRefs.length <= 3);

  const inventRefs = buildMapPlateReferences({
    referenceUrls: ["/fans/ballard-fc/interbay-stadium-map.jpg"],
    layoutSchematicUrl: "https://example.com/layout.png",
    layoutGuided: true,
    twinMode: false,
  });
  assert.equal(inventRefs[0].tag, "layout", "invent mode can use layout first");

  assert.equal(
    absoluteMediaUrl("/fans/ballard-fc/x.jpg").endsWith("/fans/ballard-fc/x.jpg"),
    true
  );
  assert.ok(absoluteMediaUrl("/fans/x.jpg").startsWith("http"));
  assert.equal(absoluteMediaUrl("https://cdn.example/a.jpg"), "https://cdn.example/a.jpg");

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
      twinMode: true,
      venueNotes: "pitch center",
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
  assert.equal(merged.mapPlate.twinMode, true);
  assert.equal(merged.mapPlate.venueNotes, "pitch center");
  assert.equal(resolveMapPlateStillUrl(merged), "https://example.com/goal.jpg");
  assert.equal(resolveMapPlateVideoUrl(merged), "https://example.com/ambient.mp4");

  const plate = defaultMapPlate({
    referenceUrls: [" a ", "", "b"],
    vibePrompt: "  hi  ",
  });
  assert.deepEqual(plate.referenceUrls, ["a", "b"]);
  assert.equal(plate.vibePrompt, "hi");
  assert.equal(plate.twinMode, true, "twin defaults on");
  assert.deepEqual(plate.variants, []);

  console.log("ok — map plate twin likeness + layout refs");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
