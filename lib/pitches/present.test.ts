import assert from "node:assert/strict";
import { startWindowedPresent } from "./present";

assert.deepEqual(startWindowedPresent({ coarsePointer: true }), {
  mode: "immersive",
  note: "Swipe up once to tuck the address bar, then share this screen.",
});

assert.deepEqual(startWindowedPresent({ coarsePointer: false }), {
  mode: "immersive",
  note: "Presenting in this window. Use expand for the whole screen.",
});

console.log("present windowed start ok");
