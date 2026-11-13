import assert from "node:assert/strict";
import { evenFitScale, fitCopyLayout, FIT_COPY_MIN_SCALE } from "./fit-copy";

assert.equal(evenFitScale(800, 600, 400, 300), 1);
assert.equal(evenFitScale(800, 400, 400, 800), 0.5);
assert.equal(evenFitScale(300, 800, 600, 400), 0.5);
assert.equal(evenFitScale(0, 400, 200, 200), 1);
assert.equal(evenFitScale(500, 500, 0, 200), 1);

assert.deepEqual(fitCopyLayout(800, 600, 400, 300), { scale: 1, scroll: false });
assert.deepEqual(fitCopyLayout(800, 400, 400, 440), { scale: 0.909, scroll: false });
assert.deepEqual(fitCopyLayout(800, 400, 400, 800), { scale: 1, scroll: true });
assert.deepEqual(fitCopyLayout(300, 800, 600, 400), { scale: 1, scroll: true });
assert.deepEqual(fitCopyLayout(800, 400, 400, 800, 0.4), { scale: 0.5, scroll: false });
assert.equal(FIT_COPY_MIN_SCALE, 0.85);

console.log("even fit scale ok");
