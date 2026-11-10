import assert from "node:assert/strict";
import { pitchFollowMargin } from "./block-space";

assert.equal(pitchFollowMargin("paragraph", "heading2"), "mt-2 sm:mt-3");
assert.equal(pitchFollowMargin("heading2", "paragraph"), "mt-8 sm:mt-11");
assert.equal(pitchFollowMargin("heading2", "heading"), "mt-4");
assert.equal(pitchFollowMargin("paragraph", "heading"), "mt-5");
assert.equal(pitchFollowMargin("paragraph", "heading2", true), "");
assert.equal(pitchFollowMargin("heading3", "heading2"), "mt-1");

console.log("pitch block spacing ok");
