import assert from "node:assert/strict";
import { bloomCalendarRelevantBody } from "./bloom-calendar";

async function main() {
  assert.equal(bloomCalendarRelevantBody({ title: "Night" }), true);
  assert.equal(bloomCalendarRelevantBody({ date: "2026-10-01" }), true);
  assert.equal(bloomCalendarRelevantBody({ worldConfig: {} }), false);
  assert.equal(bloomCalendarRelevantBody({ prompt: "x" }), false);
  assert.equal(bloomCalendarRelevantBody({ venue: "Hall", address: "1 Main" }), true);
  console.log("bloom-calendar tests passed");
}

void main();
