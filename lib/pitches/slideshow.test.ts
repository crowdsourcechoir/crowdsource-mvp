import assert from "node:assert/strict";
import { slideGesture, stepSlide } from "./slideshow";

const width = 1000;

assert.equal(slideGesture({ dx: 0, dy: 0, x: 800, width, interactive: false }), "next");
assert.equal(slideGesture({ dx: 2, dy: 1, x: 100, width, interactive: false }), "prev");
assert.equal(slideGesture({ dx: 0, dy: 0, x: 100, width, interactive: true }), "none");
assert.equal(slideGesture({ dx: -80, dy: 10, x: 400, width, interactive: false }), "next");
assert.equal(slideGesture({ dx: 90, dy: 12, x: 400, width, interactive: false }), "prev");
assert.equal(slideGesture({ dx: -20, dy: 80, x: 400, width, interactive: false }), "none");

assert.equal(stepSlide(0, 9, "prev"), 0);
assert.equal(stepSlide(0, 9, "next"), 1);
assert.equal(stepSlide(8, 9, "next"), 8);

console.log("slideshow gesture ok");
