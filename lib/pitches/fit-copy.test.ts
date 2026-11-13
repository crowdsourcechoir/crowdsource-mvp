import assert from "node:assert/strict";
import {
  columnSplitIndex,
  displayFitScale,
  evenFitScale,
  shouldScrollCopy,
  shouldSplitCopy,
} from "./fit-copy";

assert.equal(evenFitScale(800, 600, 400, 300), 1);
assert.equal(evenFitScale(800, 400, 400, 800), 0.5);
assert.equal(evenFitScale(300, 800, 600, 400), 0.5);
assert.equal(evenFitScale(0, 400, 200, 200), 1);
assert.equal(evenFitScale(500, 500, 0, 200), 1);

assert.equal(shouldSplitCopy(0.74, 1000, 700), true);
assert.equal(shouldSplitCopy(0.75, 1000, 700), false);
assert.equal(shouldSplitCopy(0.4, 600, 700), false);
assert.equal(shouldSplitCopy(0.5, 844, 390), false, "landscape phone stays one column");
assert.equal(shouldSplitCopy(0.5, 1000, 500), false, "short frame stays one column");

assert.equal(shouldScrollCopy(0.5, 390, 844), true);
assert.equal(shouldScrollCopy(0.5, 844, 390), true, "landscape phone scrolls");
assert.equal(shouldScrollCopy(0.5, 1000, 700), true);
assert.equal(shouldScrollCopy(0.95, 1000, 700), false);
assert.equal(shouldScrollCopy(1, 390, 700), true);

assert.equal(displayFitScale(0.5, 390, 700), 1);
assert.equal(displayFitScale(0.5, 844, 390), 1);
assert.equal(displayFitScale(0.5, 1000, 700), 1);
assert.equal(displayFitScale(0.95, 1000, 700), 0.95);

const paragraphs = ["paragraph", "paragraph", "paragraph", "paragraph"];
assert.equal(columnSplitIndex([10, 10, 10, 10], paragraphs), 2);
assert.equal(
  columnSplitIndex([20, 10, 10, 10], ["heading2", "paragraph", "heading2", "paragraph"]),
  2
);
assert.equal(columnSplitIndex([40, 10, 10, 10], ["heading2", "paragraph", "heading2", "paragraph"]), 2);
assert.equal(columnSplitIndex([10, 10, 10, 50], ["paragraph", "paragraph", "heading2", "paragraph"]), 2);
assert.equal(columnSplitIndex([10, 10], ["heading2", "paragraph"]), 2);
assert.equal(columnSplitIndex([10, 40], ["paragraph", "table"]), 2);
assert.equal(columnSplitIndex([10], ["paragraph"]), 1);

console.log("even fit scale ok");
