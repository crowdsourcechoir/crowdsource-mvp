import assert from "node:assert/strict";
import { SALMON_OVERLAY_COLOR, overlayColor, overlayTable } from "./photo-overlay";

assert.equal(overlayColor("#e6579e"), undefined);
assert.equal(overlayColor("#3366ff"), "#3366FF");
assert.equal(overlayColor("blue"), undefined);

const salmon = overlayTable();
assert.equal(salmon.r, "0.48 0.90 1");
assert.equal(salmon.g, "0.12 0.34 0.84");
assert.equal(salmon.b, "0.32 0.62 0.52");
assert.deepEqual(overlayTable(SALMON_OVERLAY_COLOR), salmon);

const blue = overlayTable("#0000FF");
assert.equal(blue.r.split(" ")[1], "0.00");
assert.equal(blue.g.split(" ")[1], "0.00");
assert.equal(blue.b.split(" ")[1], "1.00");
assert.ok(Number(blue.b.split(" ")[0]) < 1);
assert.ok(Number(blue.r.split(" ")[2]) > 0);

console.log("photo overlay ok");
