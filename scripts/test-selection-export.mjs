/**
 * Zip paths and labels for a Composer multi-selection.
 * Run: npx tsx scripts/test-selection-export.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const { uniqueZipEntry, selectionActionLabel, mediaSelectionId } = await load(
    "lib/composer/selection-export.ts"
  );

  const used = new Set();
  assert.equal(uniqueZipEntry("sounds", "room.wav", used), "sounds/room.wav");
  assert.equal(uniqueZipEntry("sounds", "room.wav", used), "sounds/room-2.wav");
  assert.equal(uniqueZipEntry("video", "avery photo.jpg", used), "video/avery_photo.jpg");
  assert.equal(selectionActionLabel(2, 1), "2 sounds and 1 video or photo");
  assert.equal(selectionActionLabel(0, 3), "3 videos or photos");
  assert.equal(mediaSelectionId("abc"), "media:abc");

  console.log("ok — selection export");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
