/**
 * Silence-trim unit tests (no browser AudioContext).
 * Run: node --experimental-strip-types scripts/test-silence-trim.mjs
 *   or: npx tsx scripts/test-silence-trim.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

function makeToneWithSilence({
  sampleRate = 48000,
  leadMs = 200,
  toneMs = 150,
  trailMs = 180,
  toneAmp = 0.4,
}) {
  const lead = Math.round((leadMs / 1000) * sampleRate);
  const tone = Math.round((toneMs / 1000) * sampleRate);
  const trail = Math.round((trailMs / 1000) * sampleRate);
  const length = lead + tone + trail;
  const ch = new Float32Array(length);
  for (let i = 0; i < tone; i++) {
    ch[lead + i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * toneAmp;
  }
  return { channels: [ch], sampleRate, lead, tone, trail, length };
}

async function main() {
  const { detectSilenceBounds, samplesToMs, DEFAULT_SILENCE_TRIM } = await load(
    "lib/songgarden/silence-trim.ts"
  );

  const synth = makeToneWithSilence({});
  const bounds = detectSilenceBounds(synth.channels, synth.sampleRate, DEFAULT_SILENCE_TRIM);

  assert.equal(bounds.trimmed, true);
  assert.ok(bounds.startSample < synth.lead + 100, "start should be near end of lead silence");
  assert.ok(bounds.startSample > 0, "should remove some leading silence");
  assert.ok(bounds.endSample < synth.length, "should remove some trailing silence");
  assert.ok(bounds.endSample > synth.lead + synth.tone / 2, "should keep the tone");

  const leadMs = samplesToMs(bounds.leadSilentSamples, synth.sampleRate);
  const trailMs = samplesToMs(bounds.trailSilentSamples, synth.sampleRate);
  assert.ok(leadMs > 100, `expected meaningful lead trim, got ${leadMs}`);
  assert.ok(trailMs > 100, `expected meaningful trail trim, got ${trailMs}`);

  // All silence → skipped
  const silent = [new Float32Array(4800)];
  const silentBounds = detectSilenceBounds(silent, 48000, DEFAULT_SILENCE_TRIM);
  assert.equal(silentBounds.trimmed, false);
  assert.equal(silentBounds.startSample, 0);
  assert.equal(silentBounds.endSample, 4800);

  // No leading/trailing silence → skipped or near-full
  const dense = makeToneWithSilence({ leadMs: 0, trailMs: 0, toneMs: 200 });
  const denseBounds = detectSilenceBounds(dense.channels, dense.sampleRate, DEFAULT_SILENCE_TRIM);
  assert.ok(
    !denseBounds.trimmed || denseBounds.leadSilentSamples < 64,
    "dense tone should not lose much content"
  );

  console.log("ok — silence trim");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
