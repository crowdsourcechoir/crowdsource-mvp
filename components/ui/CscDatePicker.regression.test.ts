import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const picker = readFileSync(join(process.cwd(), "components/ui/CscDatePicker.tsx"), "utf8");
const followUp = readFileSync(join(process.cwd(), "components/sales/FollowUpControls.tsx"), "utf8");

assert.match(picker, /--csc-accent/, "date picker must use design-system accent");
assert.match(picker, /--csc-shell-bg/, "date picker must use shell black, not gray");
assert.equal(/#3f3f3f|#4a4a4a|gray-700|bg-zinc-7/.test(picker), false, "no gray chrome palette");
assert.match(picker, /csc-link/, "Clear/Today must use csc-link, not browser blue");
assert.match(followUp, /CscDatePicker/, "follow-up custom date must use CscDatePicker");
assert.equal(/type="date"/.test(followUp), false, "follow-up must not use native date input");

console.log("csc-date-picker regression tests passed");
