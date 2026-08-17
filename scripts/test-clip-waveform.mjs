import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const { peaksFromSamples } = await load("lib/songgarden/waveform-peaks.ts");
  const { formatClipDuration, resolveClipSourcePrompt } = await load("lib/songgarden/clip-prompt.ts");

  const peaks = peaksFromSamples([0, 0.2, 1, 0.1, 0, 0.5, 0.9, 0.1], 8);
  assert.equal(peaks.length, 8);
  assert.ok(peaks.every((p) => p >= 0 && p <= 1));
  assert.equal(Math.max(...peaks), 1);

  assert.equal(formatClipDuration(3200), "3.2s");
  assert.equal(formatClipDuration(0), "0s");
  assert.equal(formatClipDuration(null, 12.4), "12.4s");
  assert.equal(formatClipDuration(90000), "1:30");

  const clip = {
    id: "c1",
    eventId: "e1",
    contributorName: "Joel",
    label: "RECORD",
    category: "other",
    filename: "record.wav",
    mimeType: "audio/wav",
    durationMs: 10000,
    deviceId: "d",
    sessionToken: null,
    submittedAt: "2026-08-17T00:00:00Z",
    trimLeadMs: 0,
    trimTrailMs: 0,
    trimStatus: "none",
    hasOriginal: false,
  };
  const event = {
    id: "e1",
    slug: "csc-dec3",
    title: "Gather",
    journeySteps: [
      {
        id: "s1",
        kind: "prompt",
        prompt: "Hum a note you heard on the street.",
        allowAudio: true,
        allowText: false,
        buttonLabel: "Record",
      },
    ],
  };
  const prompt = resolveClipSourcePrompt(clip, event, [clip]);
  assert.equal(prompt, "Hum a note you heard on the street.");

  const stored = resolveClipSourcePrompt({ ...clip, label: "A long stored prompt about the harbor" }, event);
  assert.match(stored, /harbor/);

  console.log("ok — clip prompt + waveform peaks");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
