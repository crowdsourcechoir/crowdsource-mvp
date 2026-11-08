import assert from "node:assert/strict";
import { presentFallback } from "./present";

assert.deepEqual(presentFallback({ coarsePointer: true }), {
  mode: "immersive",
  note: "Swipe up once to tuck the address bar, then share this screen.",
});

assert.deepEqual(presentFallback({ coarsePointer: false }), {
  mode: "immersive",
  note: "Browser chrome stayed. Share this window, or press F11 for a fuller view.",
});

console.log("present fallback ok");
