/**
 * Smoke: group persisted Runway storyboard filenames by event slug.
 * Run: npx tsx scripts/test-storyboard-recovery.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const { groupStoryboardFiles, storyboardNeedsRecovery, mergeRecoveredStoryboard } = await load(
    "lib/events-db.ts"
  );

  const grouped = groupStoryboardFiles([
    { name: "eth-global-scene-1-111.jpg", created_at: "2026-08-14T01:00:00Z" },
    { name: "eth-global-frame-1-111.mp4", created_at: "2026-08-14T01:00:10Z" },
    { name: "eth-global-scene-2-222.jpg", created_at: "2026-08-14T01:01:00Z" },
    { name: "eth-global-frame-2-222.mp4", created_at: "2026-08-14T01:01:10Z" },
    { name: "eth-global-scene-1-999.jpg", created_at: "2026-08-14T02:00:00Z" },
  ]);

  const frames = grouped.get("eth-global");
  assert.ok(frames);
  assert.equal(frames.length, 2);
  assert.ok(storyboardNeedsRecovery(null));
  assert.equal(storyboardNeedsRecovery({ worldStoryboard: frames }), false);

  const merged = mergeRecoveredStoryboard({ worldStoryboard: [] }, frames);
  assert.equal(merged.worldStoryboard.length, 2);

  const { listStoryboardVersions } = await load("lib/events-db.ts");
  const versions = listStoryboardVersions(
    [
      { name: "csc-dec3-scene-1-100.jpg", created_at: "2026-08-15T00:00:00Z" },
      { name: "csc-dec3-frame-1-101.mp4", created_at: "2026-08-15T00:00:10Z" },
      { name: "csc-dec3-scene-1-200.jpg", created_at: "2026-08-15T01:00:00Z" },
      { name: "csc-dec3-frame-1-201.mp4", created_at: "2026-08-15T01:00:10Z" },
      { name: "other-scene-1-300.jpg", created_at: "2026-08-15T02:00:00Z" },
    ],
    ["csc-dec3"]
  );
  assert.equal(versions.length, 2);
  assert.ok(versions[0].sceneFilename?.includes("200"));
  assert.ok(versions[1].sceneFilename?.includes("100"));

  console.log("ok — storyboard recovery grouping + versions");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
