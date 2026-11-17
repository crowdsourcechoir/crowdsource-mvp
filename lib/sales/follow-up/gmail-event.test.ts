import assert from "node:assert/strict";
import { followUpEventWindow } from "./gmail-event";

const window = followUpEventWindow("2026-05-04T17:00:00.000Z");
assert.equal(window?.start, "2026-05-04T09:00:00");
assert.equal(window?.end, "2026-05-04T09:01:00");
assert.equal(followUpEventWindow("not-a-date"), null);

console.log("follow-up calendar window ok");
