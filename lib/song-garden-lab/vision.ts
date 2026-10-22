import type { AxisReading } from "./analyze";
import { clamp, quantize01 } from "./quantize";
import { STRUCTURAL_AXES, type Genome, type MotionSource, type StructuralAxis } from "./types";

/**
 * Picture → genome, rules `lab-d-1`.
 * Downsample to a fixed grid, measure, normalize with fixed bounds, quantize.
 * A still has no time, so motion and articulation stay empty and the source is `still`.
 * Replay does not need the pixels.
 */
export const VISION_VERSION = "lab-d-1";

export const VISION_GRID = 32;

export type LumaFrame = {
  width: number;
  height: number;
  /** 0..1 luminance, row-major. */
  luma: Float32Array;
};

export type VisionConfig = {
  grid: number;
  windowSec: number;
  fps: number;
  /** Standard deviation of luminance that counts as a present frame. */
  presence: number;
  /** Frame-to-frame change below this is still. */
  stillDelta: number;
  /** Frame-to-frame change at or above this counts as an onset. */
  onsetDelta: number;
  forceMin: number;
  forceMax: number;
  brightnessMin: number;
  brightnessMax: number;
  articulationPerSec: number;
  /** Mean frame delta that maps to motion 1. */
  flowBound: number;
};

export type VisionReading = {
  version: string;
  still: boolean;
  frameCount: number;
  genome: Genome;
  axes: Record<StructuralAxis, AxisReading>;
  motionSource: MotionSource;
  meanLuma: number;
  contrast: number;
  meanDelta: number;
  onsets: number;
};

export function defaultVisionConfig(partial?: Partial<VisionConfig>): VisionConfig {
  return {
    grid: VISION_GRID,
    windowSec: 8,
    fps: 8,
    presence: 0.04,
    stillDelta: 0.02,
    onsetDelta: 0.08,
    forceMin: 0.02,
    forceMax: 0.35,
    brightnessMin: 0.05,
    brightnessMax: 0.95,
    articulationPerSec: 8,
    flowBound: 0.35,
    ...partial,
  };
}

export function flatFrame(value: number, size = VISION_GRID): LumaFrame {
  const luma = new Float32Array(size * size);
  luma.fill(clamp(value));
  return { width: size, height: size, luma };
}

export function checkerFrame(size = VISION_GRID): LumaFrame {
  const luma = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) luma[y * size + x] = (x + y) % 2 === 0 ? 0 : 1;
  }
  return { width: size, height: size, luma };
}

/** Built-in pictures so the mapping can be checked with no camera. */
export function testPicture(kind: "flat" | "checker" | "blink"): { frames: LumaFrame[]; still: boolean } {
  if (kind === "flat") return { frames: [flatFrame(0.5)], still: true };
  if (kind === "checker") return { frames: [checkerFrame()], still: true };
  const frames: LumaFrame[] = [];
  for (let i = 0; i < 16; i++) frames.push(flatFrame(i % 2 === 0 ? 0 : 1));
  return { frames, still: false };
}

export function analyzeFrames(
  frames: LumaFrame[],
  still: boolean,
  partial?: Partial<VisionConfig>
): VisionReading {
  const config = defaultVisionConfig(partial);
  const maxFrames = Math.max(1, Math.round(config.windowSec * config.fps));
  const source = frames.length ? frames.slice(0, maxFrames) : [flatFrame(0, config.grid)];
  const grids = source.map((frame) => downsample(frame, config.grid));
  const contrasts = grids.map(stddev);
  const lumas = grids.map(mean);
  const contrast = mean(contrasts);
  const meanLuma = mean(lumas);
  const deltas: number[] = [];
  for (let i = 1; i < grids.length; i++) deltas.push(meanAbsDiff(grids[i - 1], grids[i]));
  const meanDelta = deltas.length ? mean(deltas) : 0;
  const onsets = still ? 0 : countTurns(lumas, config.onsetDelta);
  const present = contrasts.some((value) => value >= config.presence);

  const forceRaw = contrast;
  const brightnessRaw = meanLuma;
  let sustainRaw = 0;
  let stillnessRaw = 1;
  let articulationRaw = 0;
  let motionRaw = 0;
  let motionSource: MotionSource = "still";

  if (still || grids.length < 2) {
    sustainRaw = present ? 1 : 0;
  } else {
    const span = config.windowSec * config.fps;
    sustainRaw = longestRun(contrasts, config.presence) / span;
    const stillFrames = deltas.filter((delta) => delta < config.stillDelta).length;
    stillnessRaw = deltas.length ? stillFrames / deltas.length : 1;
    const active = deltas.filter((delta) => delta >= config.stillDelta);
    motionRaw = active.length ? mean(active) : 0;
    articulationRaw = 1 - Math.exp(-(onsets / config.windowSec) / config.articulationPerSec);
    motionSource = meanDelta >= config.stillDelta ? "flow" : "still";
  }

  const readings = {
    force: reading(forceRaw, normalize(forceRaw, config.forceMin, config.forceMax)),
    sustain: reading(sustainRaw, clamp(sustainRaw)),
    stillness: reading(stillnessRaw, clamp(stillnessRaw)),
    brightness: reading(brightnessRaw, normalize(brightnessRaw, config.brightnessMin, config.brightnessMax)),
    articulation: reading(articulationRaw, clamp(articulationRaw)),
    motion: reading(motionRaw, normalize(motionRaw, 0, config.flowBound)),
  };
  const genome: Genome = {
    force: readings.force.quantized,
    sustain: readings.sustain.quantized,
    stillness: readings.stillness.quantized,
    brightness: readings.brightness.quantized,
    articulation: readings.articulation.quantized,
    motion: readings.motion.quantized,
    pitchConfidence: 0,
    register: 0.5,
    motionSource,
  };

  return {
    version: VISION_VERSION,
    still: still || grids.length < 2,
    frameCount: grids.length,
    genome,
    axes: readings,
    motionSource,
    meanLuma,
    contrast,
    meanDelta,
    onsets,
  };
}

export function downsample(frame: LumaFrame, grid: number): Float32Array {
  const out = new Float32Array(grid * grid);
  for (let y = 0; y < grid; y++) {
    const y0 = Math.floor((y * frame.height) / grid);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * frame.height) / grid));
    for (let x = 0; x < grid; x++) {
      const x0 = Math.floor((x * frame.width) / grid);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * frame.width) / grid));
      let sum = 0;
      let count = 0;
      for (let py = y0; py < y1 && py < frame.height; py++) {
        for (let px = x0; px < x1 && px < frame.width; px++) {
          sum += frame.luma[py * frame.width + px];
          count += 1;
        }
      }
      out[y * grid + x] = count ? sum / count : 0;
    }
  }
  return out;
}

function reading(raw: number, normalized: number): AxisReading {
  const unit = clamp(normalized);
  return { raw, normalized: unit, quantized: quantize01(unit) };
}

function normalize(raw: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp((raw - min) / (max - min));
}

function mean(values: ArrayLike<number>): number {
  if (!values.length) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return sum / values.length;
}

function stddev(values: Float32Array): number {
  const mid = mean(values);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const delta = values[i] - mid;
    sum += delta * delta;
  }
  return Math.sqrt(sum / values.length);
}

function meanAbsDiff(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

function longestRun(values: number[], threshold: number): number {
  let best = 0;
  let run = 0;
  for (const value of values) {
    if (value >= threshold) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

function countTurns(values: number[], threshold: number): number {
  let count = 0;
  let previous = 0;
  for (let i = 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    if (Math.abs(delta) < threshold) continue;
    if (previous === 0 || Math.sign(delta) !== Math.sign(previous)) count += 1;
    previous = delta;
  }
  return count;
}
