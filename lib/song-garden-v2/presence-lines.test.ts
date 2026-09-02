import assert from "node:assert/strict";
import {
  PARTICIPANT_COUNT_THRESHOLD,
  buildAmbientLinePool,
  pickNextAmbientLine,
} from "./presence-lines.js";

function hasCountLine(lines: ReturnType<typeof buildAmbientLinePool>): boolean {
  return lines.some((line) => line.kind === "count");
}

function main() {
  assert.equal(PARTICIPANT_COUNT_THRESHOLD, 20);

  const below = buildAmbientLinePool(
    {
      participantsTotal: 12,
      participantsRecent: 0,
      clipsTotal: 4,
      clipsRecent: 0,
      windowMinutes: 10,
    },
    true
  );
  assert.ok(!hasCountLine(below), "below threshold should not show participant totals");
  assert.ok(below.some((line) => line.kind === "ambient"), "below threshold uses signs of life");

  const atThreshold = buildAmbientLinePool(
    {
      participantsTotal: 20,
      participantsRecent: 0,
      clipsTotal: 10,
      clipsRecent: 0,
      windowMinutes: 10,
    },
    true
  );
  assert.ok(hasCountLine(atThreshold), "at threshold should include a count line");
  assert.ok(
    atThreshold.some((line) => line.text.includes("20")),
    "count line should reference the live total"
  );

  const mixed = buildAmbientLinePool(
    {
      participantsTotal: 47,
      participantsRecent: 2,
      clipsRecent: 1,
      clipsTotal: 80,
      windowMinutes: 10,
    },
    true
  );
  assert.ok(hasCountLine(mixed));
  assert.ok(mixed.some((line) => line.kind === "recent"));
  assert.ok(mixed.some((line) => line.kind === "ambient"));

  const noSim = buildAmbientLinePool(
    {
      participantsTotal: 5,
      participantsRecent: 0,
      clipsTotal: 0,
      clipsRecent: 0,
      windowMinutes: 10,
    },
    false
  );
  assert.equal(noSim.length, 0, "simulation off and no recent activity yields empty pool");

  const pool = buildAmbientLinePool(
    {
      participantsTotal: 25,
      participantsRecent: 0,
      clipsTotal: 0,
      clipsRecent: 0,
      windowMinutes: 10,
    },
    true
  );
  const first = pickNextAmbientLine(pool, null);
  const second = pickNextAmbientLine(pool, first?.text ?? null);
  assert.ok(first);
  assert.ok(second);
  assert.notEqual(first!.text, second!.text, "should avoid repeating the same line back-to-back");

  console.log("presence-lines.test.ts: ok");
}

main();
