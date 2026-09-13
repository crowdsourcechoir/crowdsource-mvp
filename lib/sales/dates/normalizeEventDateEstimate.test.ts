import assert from "node:assert/strict";
import { normalizeEventDateEstimate } from "./normalizeEventDateEstimate";

assert.equal(normalizeEventDateEstimate(null), null);
assert.equal(normalizeEventDateEstimate(""), null);
assert.equal(normalizeEventDateEstimate("2026-07-03"), "2026-07-03");
assert.equal(normalizeEventDateEstimate("July 3–7, 2026"), "2026-07-03");
assert.equal(normalizeEventDateEstimate("July 3-7, 2026"), "2026-07-03");
assert.equal(normalizeEventDateEstimate("March 4, 2027"), "2027-03-04");
assert.equal(normalizeEventDateEstimate("2027"), null);
assert.equal(normalizeEventDateEstimate("March 2027"), "2027-03-01");
assert.equal(normalizeEventDateEstimate("7/3/2026"), "2026-07-03");
assert.equal(normalizeEventDateEstimate("not a date"), null);
assert.equal(normalizeEventDateEstimate("2026-13-40"), null);

console.log("normalizeEventDateEstimate tests passed");
