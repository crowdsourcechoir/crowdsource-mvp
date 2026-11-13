import assert from "node:assert/strict";
import { columnSplitIndex, evenFitScale, shouldSplitCopy } from "./fit-copy";

assert.equal(evenFitScale(800, 600, 400, 300), 1);
assert.equal(evenFitScale(800, 400, 400, 800), 0.5);
assert.equal(evenFitScale(300, 800, 600, 400), 0.5);
assert.equal(evenFitScale(0, 400, 200, 200), 1);
assert.equal(evenFitScale(500, 500, 0, 200), 1);

assert.equal(shouldSplitCopy(0.74, 1000), true);
assert.equal(shouldSplitCopy(0.75, 1000), false);
assert.equal(shouldSplitCopy(0.4, 600), false);

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
