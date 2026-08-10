/**
 * Phase B smoke: finale + between-show pulse + historical replay.
 * Run: npx tsx scripts/test-garden-phase-b.mjs
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const prevCwd = process.cwd();
const tmp = mkdtempSync(path.join(tmpdir(), "garden-b-"));

async function load(rel) {
  return import(pathToFileURL(path.join(prevCwd, rel)).href);
}

async function main() {
  process.chdir(tmp);
  const local = await load("lib/song-garden-v2/garden/local-garden-store.ts");
  const { applyMutation, applyChapterFinale, replayMutationsToState } = await load(
    "lib/song-garden-v2/garden/apply-mutation.ts"
  );
  const { defaultMutationPolicy } = await load("lib/song-garden-v2/garden/types.ts");
  const { resolveContributionWindow } = await load("lib/song-garden-v2/garden/snapshot.ts");

  const garden = local.localCreateGarden({
    slug: "series-b",
    title: "Series B",
    status: "live",
  });
  const chapter = local.localAddChapter({
    gardenId: garden.id,
    eventId: "ev-1",
    index: 1,
    label: "Show 1",
    status: "open",
  });

  const mut1 = applyMutation(
    garden.worldState,
    {
      gardenId: garden.id,
      chapterId: chapter.id,
      kind: "percussion",
      sourceType: "clip",
      sourceId: "c1",
      deviceId: "dev_abcdefghij",
      chapterIndex: 1,
      chapterWeight: 1,
    },
    garden.mutationPolicy
  );
  let persisted = local.localPersistMutation({
    gardenId: garden.id,
    chapterId: chapter.id,
    deviceId: "dev_abcdefghij",
    kind: "percussion",
    sourceType: "clip",
    sourceId: "c1",
    delta: mut1.delta,
    effects: mut1.effects,
    nextState: mut1.nextState,
    markIndex: mut1.markIndex,
  });

  const finale = applyChapterFinale(
    persisted.garden.worldState,
    {
      gardenId: garden.id,
      chapterId: chapter.id,
      chapterIndex: 1,
      chapterLabel: "Show 1",
    },
    garden.mutationPolicy
  );
  assert.ok(finale.effects.some((e) => e.type === "chapter_bloom"));
  assert.ok(finale.effects.some((e) => e.type === "landmark_unlocked"));
  persisted = local.localPersistMutation({
    gardenId: garden.id,
    chapterId: chapter.id,
    deviceId: null,
    kind: "other",
    sourceType: "finale",
    sourceId: `finale_${chapter.id}`,
    delta: finale.delta,
    effects: finale.effects,
    nextState: finale.nextState,
    markIndex: finale.markIndex,
  });
  local.localUpdateChapter(chapter.id, { status: "closed" });

  const between = resolveContributionWindow({
    gardenStatus: "live",
    activeChapter: null,
  });
  assert.equal(between.mode, "between");
  assert.equal(between.canContribute, true);

  const pulse = applyMutation(
    persisted.garden.worldState,
    {
      gardenId: garden.id,
      chapterId: null,
      kind: "text",
      sourceType: "pulse",
      sourceId: "pulse_1",
      deviceId: "dev_abcdefghij",
      chapterWeight: garden.mutationPolicy.betweenChapterWeight,
    },
    garden.mutationPolicy
  );
  persisted = local.localPersistMutation({
    gardenId: garden.id,
    chapterId: null,
    deviceId: "dev_abcdefghij",
    kind: "text",
    sourceType: "pulse",
    sourceId: "pulse_1",
    delta: pulse.delta,
    effects: pulse.effects,
    nextState: pulse.nextState,
    markIndex: pulse.markIndex,
  });

  const all = local.localListMutations(garden.id);
  assert.ok(all.length >= 3);

  const throughFinale = all.filter((m) => m.sourceType !== "pulse");
  const rebuilt = replayMutationsToState({
    gardenId: garden.id,
    renderSeed: garden.worldState.renderSeed,
    policy: defaultMutationPolicy(garden.mutationPolicy),
    mutations: throughFinale,
  });
  assert.ok(rebuilt.landmarks.some((l) => l.key === "chapter_1"));
  assert.ok(rebuilt.energy > 0);
  assert.ok(rebuilt.energy <= persisted.garden.worldState.energy);

  console.log("ok: garden phase B finale + between + replay");
  process.chdir(prevCwd);
  rmSync(tmp, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.chdir(prevCwd);
  rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
});
