import assert from "node:assert/strict";
import { analyzePcm, resampleLinear, testTone } from "./analyze";
import { expressChannels } from "./express";
import { realizeRibbon } from "./grammar";
import { ribbonHash } from "./hash";
import { defaultLaws, zeroConditions } from "./laws";
import { genomeKey } from "./quantize";

function body(genome: ReturnType<typeof analyzePcm>["genome"]) {
  const laws = defaultLaws({ coupling: 0 });
  return ribbonHash(realizeRibbon(genome, expressChannels(genome, zeroConditions(), laws), laws));
}

function main() {
  const silence = analyzePcm(testTone("silence"), 16000);
  assert.equal(silence.genome.force, 0, "silence has no force");
  assert.equal(silence.genome.sustain, 0, "silence has no sustain");
  assert.equal(silence.genome.stillness, 1, "silence is still");
  assert.equal(silence.genome.articulation, 0, "silence has no onsets");
  assert.equal(silence.genome.motion, 0, "silence has no motion");
  assert.equal(silence.register.raw, 0.5, "unpitched register sits at the stored midpoint");
  assert.equal(silence.motionSource, "flux");

  const steady = analyzePcm(testTone("steady"), 16000);
  const bright = analyzePcm(testTone("bright"), 16000);
  const leap = analyzePcm(testTone("leap"), 16000);
  const bursts = analyzePcm(testTone("bursts"), 16000);
  const held = analyzePcm(testTone("held"), 16000);

  assert.equal(steady.motionSource, "pitch", `steady tone should lock pitch, confidence ${steady.pitchConfidence.raw}`);
  assert.ok(steady.axes.motion.normalized < 0.12, `steady motion ${steady.axes.motion.normalized}`);
  assert.ok(steady.axes.articulation.normalized < 0.2, `steady articulation ${steady.axes.articulation.normalized} onsets ${steady.onsets}`);
  assert.ok(bright.axes.brightness.normalized > steady.axes.brightness.normalized + 0.35, "a higher partial is brighter");
  assert.equal(leap.motionSource, "pitch");
  assert.ok(leap.pitchRangeSemitones > 10 && leap.pitchRangeSemitones < 14, `leap span ${leap.pitchRangeSemitones}`);
  assert.ok(leap.axes.motion.normalized > steady.axes.motion.normalized + 0.25, "a leap moves more than a drone");
  assert.equal(bursts.motionSource, "flux", `claps should miss the pitch gate, confidence ${bursts.pitchConfidence.raw}`);
  assert.ok(bursts.onsets >= 4, `bursts onsets ${bursts.onsets}`);
  assert.ok(bursts.axes.articulation.normalized > steady.axes.articulation.normalized, "claps articulate more than a held tone");
  assert.ok(bursts.axes.motion.normalized > 0.15, `clap flux motion ${bursts.axes.motion.normalized} mean ${bursts.meanFlux}`);

  assert.ok(held.sustainSec > 3.7 && held.sustainSec < 4.2, `held span ${held.sustainSec}`);
  assert.ok(Math.abs(held.axes.sustain.normalized - 0.5) < 0.04, `held sustain norm ${held.axes.sustain.normalized}`);
  assert.ok(held.axes.stillness.normalized < 0.05, `held stillness ${held.axes.stillness.normalized}`);

  const gapped = new Float32Array(4 * 16000);
  gapped.set(testTone("steady").subarray(0, 16000), 0);
  gapped.set(testTone("steady").subarray(0, 16000), 3 * 16000);
  const gap = analyzePcm(gapped, 16000);
  assert.ok(gap.axes.stillness.normalized > 0.3, `gap stillness ${gap.axes.stillness.normalized}`);
  assert.ok(gap.sustainSec < 1.3, `gap sustain seconds ${gap.sustainSec}`);
  assert.ok(Math.abs(gap.axes.stillness.normalized - (1 - gap.axes.sustain.normalized)) > 0.15, "stillness is not the complement of sustain");

  const again = analyzePcm(testTone("leap"), 16000);
  assert.equal(genomeKey(leap.genome), genomeKey(again.genome), "the same take yields the same bytes");
  const copy = Float32Array.from(testTone("leap"));
  assert.equal(genomeKey(leap.genome), genomeKey(analyzePcm(copy, 16000).genome));
  assert.equal(body(leap.genome), body(again.genome), "replay from the genome matches with the audio discarded");

  const from48k = sineAt(220, 2, 0.25, 48000);
  const resampled = analyzePcm(from48k, 48000);
  assert.equal(resampled.sampleRate, 16000);
  assert.equal(resampled.motionSource, "pitch");
  assert.ok(Math.abs(resampled.axes.brightness.normalized - steady.axes.brightness.normalized) < 0.08);

  const sameRate = resampleLinear(testTone("steady"), 16000, 16000);
  assert.equal(sameRate.length, testTone("steady").length);
  assert.equal(genomeKey(analyzePcm(sameRate, 16000).genome), genomeKey(steady.genome));

  console.log("song-garden-lab analyze tests: ok");
  console.log(
    JSON.stringify({
      steady: { motion: steady.axes.motion.normalized, art: steady.axes.articulation.normalized, bright: steady.axes.brightness.normalized, conf: steady.pitchConfidence.raw, onsets: steady.onsets },
      bright: bright.axes.brightness.normalized,
      leap: { semis: leap.pitchRangeSemitones, motion: leap.axes.motion.normalized },
      bursts: { src: bursts.motionSource, onsets: bursts.onsets, art: bursts.axes.articulation.normalized, motion: bursts.axes.motion.normalized, flux: bursts.meanFlux, conf: bursts.pitchConfidence.raw },
    })
  );
}

function sineAt(hz: number, seconds: number, amplitude: number, rate: number): Float32Array {
  const n = Math.round(seconds * rate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / rate);
  return out;
}

main();
