import assert from "node:assert/strict";
import {
  applyShowPatch,
  clampLyricSize,
  createShow,
  EMPTY_SHOW_SLIDES,
  findShow,
  GATHER_BLOOM_ID,
  gatherShow,
  listShows,
  loopsFromStoryboard,
  matchBloom,
  nextLyricCue,
  normalizeSlide,
  pickLoop,
  removeShow,
  revealedLines,
  stageScale,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  accessibleBloomBackgrounds,
} from "./model";

assert.equal(STAGE_WIDTH, 1920);
assert.equal(STAGE_HEIGHT, 1080);
assert.equal(stageScale(1920, 1080), 1);
assert.equal(stageScale(960, 1080), 0.5);
assert.equal(stageScale(1920, 540), 0.5);
assert.equal(stageScale(1280, 800), 0.667);
assert.equal(clampLyricSize(12), 36);
assert.equal(clampLyricSize(400), 180);
assert.equal(clampLyricSize(72.4), 72);

const listed = listShows(EMPTY_SHOW_SLIDES);
assert.equal(listed[0]?.slug, "gather");
assert.equal(listed[0]?.match, "gather");
assert.equal(listed[0]?.bloomId, GATHER_BLOOM_ID);
assert.equal(
  listShows({ shows: [{ ...gatherShow(), bloomId: null }] })[0]?.bloomId,
  GATHER_BLOOM_ID
);
assert.equal(
  listShows({ shows: [{ ...gatherShow(), bloomId: "bloom-other" }] })[0]?.bloomId,
  "bloom-other"
);
assert.equal(findShow(EMPTY_SHOW_SLIDES, "gather")?.name, "Gather");
assert.equal(spokenOf(listed[0]!, 0), "Gather");

const slides = [
  { lines: ["Gather", "  "] },
  { lines: ["We are in the room", "The room is the song"] },
];
assert.deepEqual(nextLyricCue({ slide: 0, revealed: 0 }, slides, "next"), { slide: 0, revealed: 1 });
assert.deepEqual(nextLyricCue({ slide: 0, revealed: 1 }, slides, "next"), { slide: 1, revealed: 0 });
assert.deepEqual(nextLyricCue({ slide: 1, revealed: 0 }, slides, "next"), { slide: 1, revealed: 1 });
assert.deepEqual(nextLyricCue({ slide: 1, revealed: 2 }, slides, "next"), { slide: 1, revealed: 2 });
assert.deepEqual(nextLyricCue({ slide: 1, revealed: 1 }, slides, "prev"), { slide: 1, revealed: 0 });
assert.deepEqual(nextLyricCue({ slide: 1, revealed: 0 }, slides, "prev"), { slide: 0, revealed: 1 });
assert.deepEqual(nextLyricCue({ slide: 0, revealed: 0 }, slides, "prev"), { slide: 0, revealed: 0 });
assert.deepEqual(nextLyricCue({ slide: 0, revealed: 0 }, slides, "none"), { slide: 0, revealed: 0 });
assert.deepEqual(revealedLines(slides[1], 1), ["We are in the room"]);

const blooms = [
  { id: "b1", slug: "harbor-night", title: "Harbor Night" },
  { id: "b2", slug: "gather-2026", title: "Gather Conference" },
];
assert.equal(matchBloom(blooms, { bloomId: null, match: "gather" })?.id, "b2");
assert.equal(matchBloom(blooms, { bloomId: "b1", match: "gather" })?.id, "b1");
assert.equal(matchBloom(blooms, { bloomId: "missing", match: "gather" }), null);

const loops = loopsFromStoryboard([
  { sceneUrl: "/still.jpg", videoUrl: null },
  { sceneUrl: "/poster.jpg", videoUrl: "https://cdn.example/loop.mp4" },
]);
assert.equal(loops[0]?.label, "Frame 1");
assert.equal(loops[0]?.sceneUrl, "/still.jpg");
assert.equal(loops[1]?.label, "Frame 2");
assert.equal(loops[1]?.videoUrl, "https://cdn.example/loop.mp4");
assert.equal(pickLoop(loops, 9)?.label, "Frame 2");
assert.equal(pickLoop([], 0), null);
assert.equal(normalizeSlide({ id: "s", lines: ["Gather"] }, 0)?.showLogo, true);
assert.equal(normalizeSlide({ id: "s", lines: ["Gather"], showLogo: false }, 0)?.showLogo, false);
assert.equal(gatherShow().slides.every((slide) => slide.showLogo), true);

const accessible = accessibleBloomBackgrounds(
  [{ sceneUrl: "/poster.jpg", videoUrl: null }],
  [
    { sceneUrl: "/poster.jpg", videoUrl: "https://cdn.example/loop.mp4", frameIndex: 0 },
    { sceneUrl: "/other.jpg", videoUrl: "https://cdn.example/loop.mp4", frameIndex: 0 },
  ],
  [{ sceneUrl: "/garden.jpg", videoUrl: "https://cdn.example/garden.mp4" }]
);
assert.equal(accessible[0]?.label, "Frame 1");
assert.equal(accessible[0]?.sceneUrl, "/poster.jpg");
assert.equal(accessible[1]?.label, "Frame 1 · stored");
assert.equal(accessible[1]?.videoUrl, "https://cdn.example/loop.mp4");
assert.equal(accessible.length, 2);
assert.equal(
  accessibleBloomBackgrounds(null, null, [{ videoUrl: "https://cdn.example/garden.mp4", sceneUrl: null }])[0]?.label,
  "Frame 1"
);

const created = createShow(EMPTY_SHOW_SLIDES, "Harbor chant", { id: "show_harbor", now: "2026-11-10T12:00:00.000Z" });
assert.ok(!("error" in created));
if ("error" in created) throw new Error(created.error);
assert.equal(created.show.slug, "harbor-chant");
const renamed = applyShowPatch(created.state, created.show, { name: "Harbor chant night" }, "2026-11-10T13:00:00.000Z");
assert.ok(!("error" in renamed));
if ("error" in renamed) throw new Error(renamed.error);
assert.equal(renamed.show.slug, "harbor-chant-night");
assert.equal(removeShow(created.state, gatherShow()).error, "Gather stays. Clear its lines if you want a blank opening.");

function spokenOf(show: { slides: { lines: string[] }[] }, index: number): string {
  return show.slides[index]?.lines[0] ?? "";
}

console.log("show slide checks passed");
