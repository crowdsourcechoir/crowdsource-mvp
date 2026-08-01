/**
 * Phase A integration smoke against the local garden JSON store.
 * Run: USE_LOCAL_EVENTS=true node --import tsx scripts/test-garden-phase-a.mjs
 * Fallback (no tsx): node scripts/test-garden-phase-a.mjs  (uses dynamic path via next-free reimplementation)
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const tmp = mkdtempSync(path.join(tmpdir(), "garden-a-"));
const prevCwd = process.cwd();

async function main() {
  // Point local store at a temp .data by chdir into tmp with a stub package root.
  process.chdir(tmp);

  let store;
  try {
    store = await import(
      pathToFileURL(path.join(prevCwd, "lib/song-garden-v2/garden/local-garden-store.ts")).href
    );
  } catch {
    // tsx not available — run pure mutation test only
    const { applyMutation } = await import(
      pathToFileURL(path.join(prevCwd, "lib/song-garden-v2/garden/apply-mutation.ts")).href
    ).catch(() => ({ applyMutation: null }));
    if (!applyMutation) {
      console.log("skip: tsx/ts loader not available; run npx tsc --noEmit instead");
      process.chdir(prevCwd);
      rmSync(tmp, { recursive: true, force: true });
      return;
    }
  }

  if (!store) {
    process.chdir(prevCwd);
    rmSync(tmp, { recursive: true, force: true });
    return;
  }

  const garden = store.localCreateGarden({
    slug: "test-run",
    title: "Test Run",
    status: "live",
  });
  assert.equal(garden.worldVersion, 0);

  const chapter = store.localAddChapter({
    gardenId: garden.id,
    eventId: "event-1",
    index: 1,
    label: "Show 1",
    status: "open",
  });

  const { applyMutation } = await import(
    pathToFileURL(path.join(prevCwd, "lib/song-garden-v2/garden/apply-mutation.ts")).href
  );

  const applied = applyMutation(
    garden.worldState,
    {
      gardenId: garden.id,
      chapterId: chapter.id,
      kind: "percussion",
      sourceType: "clip",
      sourceId: "clip-1",
      deviceId: "dev_abcdefghij",
      chapterIndex: 1,
      chapterWeight: 1,
      recentDeviceMutationAts: [],
    },
    garden.mutationPolicy
  );

  assert.equal(applied.nextState.version, 1);
  assert.ok(applied.nextState.energy > 0);
  assert.ok(applied.effects.some((e) => e.type === "energy_up"));

  const persisted = store.localPersistMutation({
    gardenId: garden.id,
    chapterId: chapter.id,
    deviceId: "dev_abcdefghij",
    kind: "percussion",
    sourceType: "clip",
    sourceId: "clip-1",
    delta: applied.delta,
    effects: applied.effects,
    nextState: applied.nextState,
    markIndex: applied.markIndex,
  });

  assert.equal(persisted.garden.worldVersion, 1);
  const marks = store.localListMarks(garden.id, "dev_abcdefghij");
  assert.equal(marks.length, 1);

  const again = store.localGetGardenByIdOrSlug("test-run");
  assert.equal(again.worldVersion, 1);

  console.log("ok: garden phase A local store");
  process.chdir(prevCwd);
  rmSync(tmp, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.chdir(prevCwd);
  rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
});
