import assert from "node:assert/strict";
import { defaultBrandKit } from "./types";

function main() {
  const kit = defaultBrandKit({
    title: "Test",
    zones: [
      {
        key: "north-end",
        label: "North End",
        x: 0.3,
        y: 0.2,
        engageMode: "pulse",
      },
      {
        key: "south-roar",
        label: "South Roar",
        x: 0.7,
        y: 0.8,
        engageMode: "journey",
        journeyEventId: "evt_123",
        prompt: "Claim the south roar",
        ctaLabel: "Start the chant journey",
      },
      {
        key: "broken",
        label: "Broken journey",
        x: 0.5,
        y: 0.5,
        engageMode: "journey",
        // missing journeyEventId should normalize to null
      },
    ],
  });

  assert.equal(kit.zones.length, 3);
  assert.equal(kit.zones[0].engageMode, "pulse");
  assert.equal(kit.zones[0].journeyEventId, null);
  assert.equal(kit.zones[1].engageMode, "journey");
  assert.equal(kit.zones[1].journeyEventId, "evt_123");
  assert.equal(kit.zones[1].ctaLabel, "Start the chant journey");
  assert.equal(kit.zones[2].engageMode, "journey");
  assert.equal(kit.zones[2].journeyEventId, null);

  console.log("zone-journeys.test.ts: ok");
}

main();
