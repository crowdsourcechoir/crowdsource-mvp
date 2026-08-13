/**
 * Smoke: multi place-ref normalize + merge for storyboard AI.
 * Run: npx tsx scripts/test-storyboard-multi-refs.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const {
    normalizePlaceReferenceUris,
    mergeStoryboardReferences,
    STORYBOARD_MAX_REFS,
  } = await load("lib/song-garden-v2/storyboard-refs.ts");

  assert.equal(STORYBOARD_MAX_REFS, 3);

  const normalized = normalizePlaceReferenceUris({
    referenceUrls: ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg", "not-a-url"],
    imageDataUrls: ["data:image/jpeg;base64,abc"],
    imageDataUrl: "https://cdn.example/legacy.jpg",
  });
  assert.deepEqual(normalized, [
    "https://cdn.example/a.jpg",
    "https://cdn.example/b.jpg",
    "data:image/jpeg;base64,abc",
  ]);

  const full = mergeStoryboardReferences({
    placeUris: [
      "https://cdn.example/a.jpg",
      "https://cdn.example/b.jpg",
      "https://cdn.example/c.jpg",
    ],
    frameIndex: 0,
    frameCount: 4,
  });
  assert.equal(full.referenceImages.length, 3);
  assert.deepEqual(
    full.referenceImages.map((r) => r.tag),
    ["place", "place2", "place3"]
  );
  assert.deepEqual(full.siblingTags, []);

  const regen = mergeStoryboardReferences({
    placeUris: ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"],
    siblingSceneUrls: [null, "https://cdn.example/s1.jpg", "https://cdn.example/s2.jpg"],
    frameIndex: 0,
    frameCount: 3,
  });
  assert.equal(regen.referenceImages.length, 3);
  assert.equal(regen.siblingTags.length, 1);
  assert.equal(regen.placeTags.length, 2);
  assert.equal(regen.referenceImages[0].tag, "world1");
  assert.deepEqual(regen.placeTags, ["place", "place2"]);

  console.log("ok — storyboard multi-refs");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
