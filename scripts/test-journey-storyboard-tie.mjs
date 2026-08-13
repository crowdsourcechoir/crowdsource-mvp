/**
 * Smoke: prompt ↔ storyboard frame binding.
 * Run: npx tsx scripts/test-journey-storyboard-tie.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const {
    normalizeJourneySteps,
    resolveTiedStoryboardFrameIndex,
  } = await load("lib/songgarden/journey-steps.ts");
  const {
    resolveStoryboardFrame,
    resolveStoryboardFrameAtIndex,
    normalizeWorldConfigInput,
  } = await load("lib/song-garden-v2/world-config.ts");

  const steps = normalizeJourneySteps([
    { id: "n", kind: "name", prompt: "Name?" },
    { id: "a", kind: "prompt", prompt: "Words", allowText: true },
    {
      id: "b",
      kind: "prompt",
      prompt: "Sing",
      allowAudio: true,
      storyboardFrameIndex: 2,
    },
    { id: "c", kind: "prompt", prompt: "More", allowText: true },
    {
      id: "d",
      kind: "prompt",
      prompt: "Finale feel",
      allowText: true,
      storyboardFrameIndex: 4,
    },
  ]);

  assert.equal(steps[2].storyboardFrameIndex, 2);
  assert.equal(steps[3].storyboardFrameIndex, undefined);
  assert.equal(resolveTiedStoryboardFrameIndex(steps, 0), null);
  assert.equal(resolveTiedStoryboardFrameIndex(steps, 1), null);
  assert.equal(resolveTiedStoryboardFrameIndex(steps, 2), 2);
  assert.equal(resolveTiedStoryboardFrameIndex(steps, 3), 2, "holds previous");
  assert.equal(resolveTiedStoryboardFrameIndex(steps, 4), 4);

  const world = normalizeWorldConfigInput({
    title: "Test",
    worldStoryboard: [
      { sceneUrl: "/a.jpg", videoUrl: null },
      { sceneUrl: "/b.jpg", videoUrl: null },
      { sceneUrl: "/c.jpg", videoUrl: null },
      { sceneUrl: "/d.jpg", videoUrl: null },
      { sceneUrl: "/e.jpg", videoUrl: null },
    ],
  });
  assert.ok(world);
  const tied = resolveStoryboardFrameAtIndex(world, 2);
  assert.equal(tied?.index, 2);
  assert.equal(tied?.frame.sceneUrl, "/c.jpg");
  const auto = resolveStoryboardFrame(world, 0);
  assert.equal(auto?.index, 0);

  console.log("ok — prompt storyboard frame ties");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
