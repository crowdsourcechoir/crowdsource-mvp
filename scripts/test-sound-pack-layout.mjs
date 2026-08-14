/**
 * Smoke: sound pack zip path layout.
 * Run: npx tsx scripts/test-sound-pack-layout.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const { buildSoundPackLayout, soundPackPathSegment } = await load(
    "lib/songgarden/sound-pack.ts"
  );

  assert.equal(soundPackPathSegment("Joel Smith"), "Joel_Smith");
  assert.equal(soundPackPathSegment("  "), "untitled");

  const { entries, manifest } = buildSoundPackLayout({
    eventId: "evt1",
    eventSlug: "eth-global",
    clips: [
      {
        id: "c1",
        eventId: "evt1",
        contributorName: "Joel",
        label: "ONE WORD",
        category: "vocal",
        filename: "one.wav",
        mimeType: "audio/wav",
        durationMs: 1200,
        deviceId: "d",
        sessionToken: null,
        submittedAt: "2026-05-26T17:39:00Z",
        trimLeadMs: 40,
        trimTrailMs: 20,
        trimStatus: "trimmed",
        hasOriginal: true,
      },
      {
        id: "c2",
        eventId: "evt1",
        contributorName: "Joel",
        label: "TAP",
        category: "percussion",
        filename: "tap.wav",
        mimeType: "audio/wav",
        durationMs: 400,
        deviceId: "d",
        sessionToken: null,
        submittedAt: "2026-05-26T17:40:00Z",
        trimLeadMs: 0,
        trimTrailMs: 0,
        trimStatus: "skipped",
        hasOriginal: true,
      },
      {
        id: "c3",
        eventId: "evt1",
        contributorName: null,
        label: "Hum",
        category: "ambient",
        filename: "hum.wav",
        mimeType: "audio/wav",
        durationMs: null,
        deviceId: "d2",
        sessionToken: null,
        submittedAt: "2026-05-26T17:41:00Z",
        trimLeadMs: null,
        trimTrailMs: null,
        trimStatus: "none",
        hasOriginal: false,
      },
    ],
  });

  assert.equal(manifest.clipCount, 3);
  assert.ok(manifest.kitClipCount >= 2);
  // person + category for each clip, plus kit entries
  assert.ok(entries.length >= 6 + manifest.kitClipCount);
  assert.ok(entries.some((e) => e.path.startsWith("by-person/Joel/vocal/")));
  assert.ok(entries.some((e) => e.path.startsWith("by-category/percussion/Joel-")));
  assert.ok(entries.some((e) => e.path.startsWith("by-person/Anonymous/ambient/")));
  assert.ok(entries.some((e) => e.path.startsWith("kit/ableton-starter/")));
  assert.ok(manifest.clips.every((c) => typeof c.trimStatus === "string"));

  console.log("ok — sound pack layout");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
