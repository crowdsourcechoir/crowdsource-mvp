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

  console.log("ok — storyboard recovery grouping");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
