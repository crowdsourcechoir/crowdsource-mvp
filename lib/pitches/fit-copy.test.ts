import assert from "node:assert/strict";
import { evenFitScale } from "./fit-copy";

assert.equal(evenFitScale(800, 600, 400, 300), 1);
assert.equal(evenFitScale(800, 400, 400, 800), 0.5);
assert.equal(evenFitScale(300, 800, 600, 400), 0.5);
assert.equal(evenFitScale(0, 400, 200, 200), 1);
assert.equal(evenFitScale(500, 500, 0, 200), 1);

console.log("even fit scale ok");
