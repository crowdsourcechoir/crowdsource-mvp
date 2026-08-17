/**
 * Silence-trim unit tests (no browser AudioContext).
 * Run: npx tsx scripts/test-silence-trim.mjs
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
  noiseAmp = 0,
}) {
  const lead = Math.round((leadMs / 1000) * sampleRate);
  const tone = Math.round((toneMs / 1000) * sampleRate);
  const trail = Math.round((trailMs / 1000) * sampleRate);
  const length = lead + tone + trail;
  const ch = new Float32Array(length);
  let seed = 12345;
  const noise = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return ((seed / 0xffffffff) * 2 - 1) * noiseAmp;
  };
  for (let i = 0; i < length; i++) ch[i] = noiseAmp ? noise() : 0;
  for (let i = 0; i < tone; i++) {
    ch[lead + i] += Math.sin((2 * Math.PI * 440 * i) / sampleRate) * toneAmp;
  }
  return { channels: [ch], sampleRate, lead, tone, trail, length };
}

function peakAbs(ch) {
  let p = 0;
  for (let i = 0; i < ch.length; i++) {
    const v = Math.abs(ch[i]);
    if (v > p) p = v;
  }
  return p;
}

/** Old Song Garden gate: any window over 0.012 peak counted as content. */
function oldPeakAbsWouldTrim(ch, threshold = 0.012, win = 256) {
  const length = ch.length;
  let firstLoud = -1;
  let lastLoud = -1;
  for (let i = 0; i < length; i += win) {
    const to = Math.min(i + win, length);
    let peak = 0;
    for (let j = i; j < to; j++) {
      const v = Math.abs(ch[j]);
      if (v > peak) peak = v;
    }
    if (peak >= threshold) {
      if (firstLoud < 0) firstLoud = i;
      lastLoud = to;
    }
  }
  return firstLoud > 0 || (lastLoud > 0 && lastLoud < length);
}

async function main() {
  const { detectSilenceBounds, samplesToMs, DEFAULT_SILENCE_TRIM } = await load(
    "lib/songgarden/silence-trim.ts"
  );
  const { encodePcmWav, decodePcmWav } = await load("lib/songgarden/pcm-wav.ts");
  const { applySilenceTrimToWav } = await load("lib/songgarden/trim-wav.ts");

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

  // Room hiss (~0.03 peak) used to defeat peak-abs gating (threshold 0.012).
  const noisy = makeToneWithSilence({
    leadMs: 400,
    toneMs: 180,
    trailMs: 320,
    toneAmp: 0.45,
    noiseAmp: 0.03,
  });
  const noisyPeak = peakAbs(noisy.channels[0]);
  assert.ok(noisyPeak > 0.012, "fixture must exceed the old peak-abs threshold");
  assert.equal(
    oldPeakAbsWouldTrim(noisy.channels[0]),
    false,
    "old peak-abs gate skipped this room-hiss take"
  );
  const noisyBounds = detectSilenceBounds(noisy.channels, noisy.sampleRate, DEFAULT_SILENCE_TRIM);
  assert.equal(noisyBounds.trimmed, true, "adaptive RMS should trim noisy lead/trail");
  assert.ok(noisyBounds.startSample > noisy.sampleRate * 0.2, "should drop most of the noisy lead");
  assert.ok(noisyBounds.endSample < noisy.length - noisy.sampleRate * 0.15, "should drop noisy trail");
  assert.ok(
    noisyBounds.endSample - noisyBounds.startSample < noisy.tone + noisy.sampleRate * 0.12,
    "kept region should be the tone plus a short pad"
  );

  const hissOnly = makeToneWithSilence({
    leadMs: 300,
    toneMs: 0,
    trailMs: 0,
    toneAmp: 0,
    noiseAmp: 0.03,
  });
  const hissBounds = detectSilenceBounds(hissOnly.channels, hissOnly.sampleRate, DEFAULT_SILENCE_TRIM);
  assert.equal(hissBounds.trimmed, false, "hiss-only should not invent a content region");

  const wav = encodePcmWav(noisy.channels, noisy.sampleRate);
  const decoded = decodePcmWav(wav);
  assert.ok(decoded, "roundtrip decode");
  assert.equal(decoded.sampleRate, noisy.sampleRate);
  assert.equal(decoded.channels[0].length, noisy.length);

  const applied = applySilenceTrimToWav(wav);
  assert.ok(applied);
  assert.equal(applied.trimStatus, "trimmed");
  assert.ok(applied.durationMs < applied.originalDurationMs - 400, "playable WAV shorter than original");
  assert.ok(applied.trimLeadMs > 200, `server trim lead ${applied.trimLeadMs}ms`);
  assert.ok(applied.trimTrailMs > 150, `server trim trail ${applied.trimTrailMs}ms`);
  assert.ok(applied.playable.byteLength < applied.original.byteLength);

  // Same path the upload API uses (Node Buffer, which is a Uint8Array view).
  const asBuffer = Buffer.from(wav);
  const fromBuffer = applySilenceTrimToWav(asBuffer);
  assert.ok(fromBuffer);
  assert.equal(fromBuffer.trimStatus, "trimmed");
  assert.equal(fromBuffer.trimLeadMs, applied.trimLeadMs);
  assert.equal(fromBuffer.playable.byteLength, applied.playable.byteLength);

  const second = applySilenceTrimToWav(applied.playable);
  assert.ok(second);
  assert.ok(
    second.trimStatus === "skipped" || second.trimLeadMs + second.trimTrailMs < 80,
    "second pass on already-trimmed WAV should be a no-op or tiny pad shave"
  );

  console.log("ok — silence trim");
  console.log(
    JSON.stringify(
      {
        digitalSilence: { leadMs, trailMs, trimmed: bounds.trimmed },
        noisyRoom: {
          trimmed: noisyBounds.trimmed,
          leadMs: samplesToMs(noisyBounds.leadSilentSamples, noisy.sampleRate),
          trailMs: samplesToMs(noisyBounds.trailSilentSamples, noisy.sampleRate),
          keptMs: samplesToMs(noisyBounds.endSample - noisyBounds.startSample, noisy.sampleRate),
          originalMs: samplesToMs(noisy.length, noisy.sampleRate),
        },
        serverWav: {
          trimStatus: applied.trimStatus,
          leadMs: applied.trimLeadMs,
          trailMs: applied.trimTrailMs,
          playableMs: applied.durationMs,
          originalMs: applied.originalDurationMs,
          playableBytes: applied.playable.byteLength,
          originalBytes: applied.original.byteLength,
        },
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
