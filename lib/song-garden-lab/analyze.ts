import { clamp, quantize01 } from "./quantize";
import {
  QUANTIZE_STEPS,
  STRUCTURAL_AXES,
  type Genome,
  type MotionSource,
  type StructuralAxis,
} from "./types";

/**
 * Voice → genome, rules `lab-b-1`.
 * Resample to 16 kHz, measure, normalize with fixed bounds, quantize.
 * Same samples always yield the same genome. Replay does not need the audio.
 */
export const ANALYSIS_VERSION = "lab-b-1";

export type AnalysisConfig = {
  sampleRate: number;
  frameSize: number;
  hop: number;
  /** Capture window. Sustain is divided by this, even when the take is shorter. */
  windowSec: number;
  forceDbMin: number;
  forceDbMax: number;
  sustainDb: number;
  stillnessDb: number;
  brightnessMinHz: number;
  brightnessMaxHz: number;
  /** Time constant for the articulation soft clip, in onsets per second. */
  articulationPerSec: number;
  pitchMinHz: number;
  pitchMaxHz: number;
  /** Mean periodicity at or above this selects pitch-span motion. Below it, spectral flux. */
  pitchGate: number;
  motionSemitones: number;
  /** Mean normalized spectral flux that maps to motion 1 when the pitch gate is closed. */
  fluxBound: number;
  /** Local-maximum flux at or above this counts as an onset. */
  onsetFlux: number;
  quantizeSteps: number;
};

export type AxisReading = {
  raw: number;
  normalized: number;
  quantized: number;
};

export type AnalysisReading = {
  version: string;
  sampleRate: number;
  sampleCount: number;
  durationSec: number;
  genome: Genome;
  axes: Record<StructuralAxis, AxisReading>;
  pitchConfidence: AxisReading;
  register: AxisReading;
  motionSource: MotionSource;
  onsets: number;
  centroidHz: number;
  forceDb: number;
  sustainSec: number;
  pitchRangeSemitones: number;
  meanFlux: number;
};

export function defaultAnalysisConfig(partial?: Partial<AnalysisConfig>): AnalysisConfig {
  return {
    sampleRate: 16000,
    frameSize: 1024,
    hop: 256,
    windowSec: 8,
    forceDbMin: -50,
    forceDbMax: -8,
    sustainDb: -40,
    stillnessDb: -45,
    brightnessMinHz: 200,
    brightnessMaxHz: 4000,
    articulationPerSec: 8,
    pitchMinHz: 80,
    pitchMaxHz: 800,
    pitchGate: 0.45,
    motionSemitones: 24,
    fluxBound: 2,
    onsetFlux: 0.4,
    quantizeSteps: QUANTIZE_STEPS,
    ...partial,
  };
}

export function analyzePcm(
  input: Float32Array,
  inputRate: number,
  partial?: Partial<AnalysisConfig>
): AnalysisReading {
  const config = defaultAnalysisConfig(partial);
  const resampled = resampleLinear(input, inputRate, config.sampleRate);
  const maxSamples = Math.max(1, Math.round(config.windowSec * config.sampleRate));
  const samples = resampled.length > maxSamples ? resampled.subarray(0, maxSamples) : resampled;
  return measure(samples, config);
}

/** Synthetic takes for the lab and the headless check. Generated at 16 kHz. */
export function testTone(kind: "silence" | "steady" | "leap" | "bright" | "bursts" | "held"): Float32Array {
  const rate = 16000;
  if (kind === "silence") return new Float32Array(rate);
  if (kind === "steady") return sine(220, 2, 0.25, rate);
  if (kind === "bright") return sine(2000, 2, 0.25, rate);
  if (kind === "held") return sine(220, 4, 0.25, rate);
  if (kind === "leap") {
    const n = Math.round(3 * rate);
    const out = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const hz = i < n / 2 ? 220 : 440;
      phase += (2 * Math.PI * hz) / rate;
      out[i] = 0.25 * Math.sin(phase);
    }
    return out;
  }
  const n = Math.round(2 * rate);
  const out = new Float32Array(n);
  const rand = mulberry32(0x5eed);
  const burst = Math.round(0.04 * rate);
  const gap = Math.round(0.16 * rate);
  for (let b = 0; b < 8; b++) {
    const start = b * (burst + gap);
    for (let i = 0; i < burst && start + i < n; i++) {
      out[start + i] = (rand() * 2 - 1) * 0.55;
    }
  }
  return out;
}

export function deadAxes(genomes: Genome[], steps = QUANTIZE_STEPS): StructuralAxis[] {
  if (genomes.length < 2) return [];
  const span = 2 / Math.max(1, steps);
  return STRUCTURAL_AXES.filter((axis) => {
    let min = Infinity;
    let max = -Infinity;
    for (const genome of genomes) {
      min = Math.min(min, genome[axis]);
      max = Math.max(max, genome[axis]);
    }
    return max - min < span;
  });
}

function measure(samples: Float32Array, config: AnalysisConfig): AnalysisReading {
  const n = samples.length;
  const durationSec = n / config.sampleRate;
  const forceDb = rmsDb(samples);
  const frames = frameFeatures(samples, config);
  const sounding = frames.filter((frame) => frame.db >= config.sustainDb);
  const sustainSec = longestRunSeconds(frames, config);
  const stillness = frames.length ? frames.filter((frame) => frame.db < config.stillnessDb).length / frames.length : 1;
  const centroidHz = sounding.length
    ? sounding.reduce((sum, frame) => sum + frame.centroidHz, 0) / sounding.length
    : 0;
  const onsets = countOnsets(frames, config);
  const onsetRate = durationSec > 0 ? onsets / durationSec : 0;
  const pitched = sounding.filter((frame) => frame.pitchConfidence >= config.pitchGate && frame.pitchHz > 0);
  const pitchConfidence = sounding.length
    ? sounding.reduce((sum, frame) => sum + frame.pitchConfidence, 0) / sounding.length
    : 0;
  const usePitch = pitchConfidence >= config.pitchGate && pitched.length >= 2;
  const pitchRangeSemitones = usePitch ? semitoneSpan(pitched.map((frame) => frame.pitchHz)) : 0;
  const meanFlux = sounding.length ? sounding.reduce((sum, frame) => sum + frame.flux, 0) / sounding.length : 0;
  const motionSource: MotionSource = usePitch ? "pitch" : "flux";
  const registerRaw = usePitch ? logNorm(median(pitched.map((frame) => frame.pitchHz)), 65.40639132514966, 1046.5022612023945) : 0.5;

  const normalized = {
    force: normRange(forceDb, config.forceDbMin, config.forceDbMax),
    sustain: clamp(sustainSec / config.windowSec),
    stillness: clamp(stillness),
    brightness: logNorm(centroidHz, config.brightnessMinHz, config.brightnessMaxHz),
    articulation: softClipRate(onsetRate, config.articulationPerSec),
    motion: usePitch
      ? clamp(pitchRangeSemitones / config.motionSemitones)
      : clamp(config.fluxBound > 0 ? meanFlux / config.fluxBound : 0),
  };

  const axes = {} as Record<StructuralAxis, AxisReading>;
  const raws: Record<StructuralAxis, number> = {
    force: Number.isFinite(forceDb) ? forceDb : config.forceDbMin,
    sustain: sustainSec,
    stillness,
    brightness: centroidHz,
    articulation: onsetRate,
    motion: usePitch ? pitchRangeSemitones : meanFlux,
  };
  for (const axis of STRUCTURAL_AXES) {
    const quantized = quantizeGrid(normalized[axis], config.quantizeSteps);
    axes[axis] = { raw: raws[axis], normalized: normalized[axis], quantized };
  }

  const pitchReading: AxisReading = {
    raw: pitchConfidence,
    normalized: clamp(pitchConfidence),
    quantized: quantizeGrid(pitchConfidence, config.quantizeSteps),
  };
  const registerReading: AxisReading = {
    raw: registerRaw,
    normalized: clamp(registerRaw),
    quantized: quantizeGrid(registerRaw, config.quantizeSteps),
  };

  const genome: Genome = {
    force: axes.force.quantized,
    sustain: axes.sustain.quantized,
    stillness: axes.stillness.quantized,
    brightness: axes.brightness.quantized,
    articulation: axes.articulation.quantized,
    motion: axes.motion.quantized,
    pitchConfidence: pitchReading.quantized,
    register: registerReading.quantized,
    motionSource,
  };

  return {
    version: ANALYSIS_VERSION,
    sampleRate: config.sampleRate,
    sampleCount: n,
    durationSec,
    genome,
    axes,
    pitchConfidence: pitchReading,
    register: registerReading,
    motionSource,
    onsets,
    centroidHz,
    forceDb,
    sustainSec,
    pitchRangeSemitones,
    meanFlux,
  };
}

type FrameFeature = {
  db: number;
  centroidHz: number;
  flux: number;
  pitchHz: number;
  pitchConfidence: number;
};

function frameFeatures(samples: Float32Array, config: AnalysisConfig): FrameFeature[] {
  const { frameSize, hop, sampleRate } = config;
  if (samples.length < frameSize) return [];
  const count = Math.floor((samples.length - frameSize) / hop) + 1;
  const hann = hannWindow(frameSize);
  const frames: FrameFeature[] = [];
  let prevMag: Float64Array | null = null;
  const minLag = Math.max(1, Math.floor(sampleRate / config.pitchMaxHz));
  const maxLag = Math.min(frameSize - 2, Math.floor(sampleRate / config.pitchMinHz));

  for (let index = 0; index < count; index++) {
    const start = index * hop;
    const windowed = new Float64Array(frameSize);
    let energy = 0;
    for (let i = 0; i < frameSize; i++) {
      const sample = samples[start + i] || 0;
      energy += sample * sample;
      windowed[i] = sample * hann[i];
    }
    const rms = Math.sqrt(energy / frameSize);
    const db = rms > 1e-10 ? 20 * Math.log10(rms) : -120;
    const { mag, centroidHz } = spectrum(windowed, sampleRate);
    const flux = spectralFlux(mag, prevMag);
    prevMag = mag;
    const pitch = autocorrelationPitch(windowed, sampleRate, minLag, maxLag);
    frames.push({ db, centroidHz, flux, pitchHz: pitch.hz, pitchConfidence: pitch.confidence });
  }
  return frames;
}

function spectrum(windowed: Float64Array, sampleRate: number): { mag: Float64Array; centroidHz: number } {
  const n = windowed.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  re.set(windowed);
  fft(re, im);
  const bins = n / 2;
  const mag = new Float64Array(bins);
  let num = 0;
  let den = 0;
  for (let k = 1; k < bins; k++) {
    const magnitude = Math.hypot(re[k], im[k]);
    mag[k] = magnitude;
    const freq = (k * sampleRate) / n;
    num += freq * magnitude;
    den += magnitude;
  }
  return { mag, centroidHz: den > 0 ? num / den : 0 };
}

function spectralFlux(mag: Float64Array, prev: Float64Array | null): number {
  let pos = 0;
  let prevEnergy = 0;
  let energy = 0;
  for (let k = 1; k < mag.length; k++) {
    energy += mag[k];
    if (prev) {
      prevEnergy += prev[k];
      pos += Math.max(0, mag[k] - prev[k]);
    }
  }
  if (!prev || prevEnergy < 1e-8) return energy > 1e-6 ? 1 : 0;
  return pos / prevEnergy;
}

function autocorrelationPitch(
  frame: Float64Array,
  sampleRate: number,
  minLag: number,
  maxLag: number
): { hz: number; confidence: number } {
  if (maxLag <= minLag) return { hz: 0, confidence: 0 };
  const n = frame.length;
  const scores = new Float64Array(maxLag + 2);
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let left = 0;
    let right = 0;
    const limit = n - lag;
    for (let i = 0; i < limit; i++) {
      const a = frame[i];
      const b = frame[i + lag];
      sum += a * b;
      left += a * a;
      right += b * b;
    }
    const denom = Math.sqrt(left * right);
    const score = denom > 1e-12 ? sum / denom : 0;
    scores[lag] = score;
    if (score > best) best = score;
  }
  if (best <= 0) return { hz: 0, confidence: 0 };
  const floor = best * 0.98;
  let lag = minLag;
  for (let candidate = minLag; candidate <= maxLag; candidate++) {
    if (scores[candidate] >= floor) {
      lag = candidate;
      break;
    }
  }
  let delta = 0;
  if (lag > minLag && lag < maxLag) {
    const y0 = scores[lag - 1];
    const y1 = scores[lag];
    const y2 = scores[lag + 1];
    const denom = y0 - 2 * y1 + y2;
    if (Math.abs(denom) > 1e-12) delta = clamp((0.5 * (y0 - y2)) / denom, -0.5, 0.5);
  }
  const hz = sampleRate / (lag + delta);
  return { hz, confidence: clamp(best) };
}

function countOnsets(frames: FrameFeature[], config: AnalysisConfig): number {
  let count = 0;
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (frame.db < config.sustainDb) continue;
    if (frame.flux < config.onsetFlux) continue;
    const prev = i > 0 ? frames[i - 1].flux : -1;
    const next = i + 1 < frames.length ? frames[i + 1].flux : -1;
    if (frame.flux >= prev && frame.flux > next) count += 1;
  }
  return count;
}

function longestRunSeconds(frames: FrameFeature[], config: AnalysisConfig): number {
  let best = 0;
  let run = 0;
  for (const frame of frames) {
    if (frame.db >= config.sustainDb) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  if (best === 0) return 0;
  return ((best - 1) * config.hop + config.frameSize) / config.sampleRate;
}

function semitoneSpan(freqs: number[]): number {
  let min = Infinity;
  let max = 0;
  for (const freq of freqs) {
    if (freq > 0) {
      min = Math.min(min, freq);
      max = Math.max(max, freq);
    }
  }
  if (!Number.isFinite(min) || max <= 0) return 0;
  return Math.abs(12 * Math.log2(max / min));
}

function rmsDb(samples: Float32Array): number {
  if (!samples.length) return -120;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / samples.length);
  if (rms < 1e-10) return -120;
  return 20 * Math.log10(rms);
}

function softClipRate(rate: number, full: number): number {
  if (!(rate > 0) || !(full > 0)) return 0;
  return clamp(1 - Math.exp(-rate / full));
}

function logNorm(value: number, min: number, max: number): number {
  if (!(value > 0) || !(min > 0) || !(max > min)) return 0;
  return clamp((Math.log(value) - Math.log(min)) / (Math.log(max) - Math.log(min)));
}

function normRange(value: number, min: number, max: number): number {
  if (!(max > min) || !Number.isFinite(value)) return 0;
  return clamp((value - min) / (max - min));
}

function quantizeGrid(normalized: number, steps: number): number {
  const grid = Math.max(1, Math.round(steps));
  if (grid === QUANTIZE_STEPS) return quantize01(normalized);
  return Math.round(clamp(normalized) * grid) / grid;
}

function hannWindow(n: number): Float64Array {
  const window = new Float64Array(n);
  for (let i = 0; i < n; i++) window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  return window;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (!input.length) return new Float32Array();
  if (fromRate === toRate) return Float32Array.from(input);
  const outLength = Math.max(1, Math.round((input.length * toRate) / fromRate));
  const out = new Float32Array(outLength);
  const ratio = fromRate / toRate;
  const last = input.length - 1;
  for (let i = 0; i < outLength; i++) {
    const position = i * ratio;
    const i0 = Math.min(last, Math.floor(position));
    const i1 = Math.min(last, i0 + 1);
    const t = position - i0;
    out[i] = input[i0] * (1 - t) + input[i1] * t;
  }
  return out;
}

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(angle);
    const wlenIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const odd = i + j + half;
        const even = i + j;
        const vRe = re[odd] * wRe - im[odd] * wIm;
        const vIm = re[odd] * wIm + im[odd] * wRe;
        re[odd] = re[even] - vRe;
        im[odd] = im[even] - vIm;
        re[even] += vRe;
        im[even] += vIm;
        const nextRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextRe;
      }
    }
  }
}

function sine(hz: number, seconds: number, amplitude: number, rate: number): Float32Array {
  const n = Math.round(seconds * rate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / rate);
  return out;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
