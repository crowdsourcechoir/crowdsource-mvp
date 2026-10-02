"use client";

import { useEffect, useRef, useState } from "react";
import { genomeKey } from "@/lib/song-garden-lab/quantize";
import { STRUCTURAL_AXES, type Conditions } from "@/lib/song-garden-lab/types";
import {
  VISION_VERSION,
  analyzeFrames,
  testPicture,
  type LumaFrame,
  type VisionReading,
} from "@/lib/song-garden-lab/vision";
import WordsPanel from "@/components/song-garden-lab/WordsPanel";

const PROMPTS = ["Hold still", "Cross the frame", "A bright field", "Something small", "Leave it empty"];

export default function SeenPanel({
  birth,
  coupling,
  onBirth,
  onCoupling,
  onReading,
}: {
  birth: Conditions;
  coupling: number;
  onBirth: (birth: Conditions) => void;
  onCoupling: (coupling: number) => void;
  onReading: (reading: VisionReading | null) => void;
}) {
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [reading, setReading] = useState<VisionReading | null>(null);
  const [label, setLabel] = useState("");
  const [held, setHeld] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const framesRef = useRef<LumaFrame[] | null>(null);
  const stillRef = useRef(true);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  function publish(frames: LumaFrame[], still: boolean, nextLabel: string) {
    framesRef.current = frames;
    stillRef.current = still;
    const next = analyzeFrames(frames, still);
    setReading(next);
    setLabel(nextLabel);
    setHeld(true);
    setError("");
    onReading(next);
  }

  function dropPicture() {
    framesRef.current = null;
    setHeld(false);
  }

  async function startRecord() {
    setError("");
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      stream.getTracks().forEach((track) => track.stop());
      setError("This browser could not read the picture.");
      return;
    }
    const frames: LumaFrame[] = [];
    const started = performance.now();
    setRecording(true);
    setSeconds(0);
    let timer = 0;
    const finish = () => {
      window.clearInterval(timer);
      stopRef.current = null;
      stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
      publish(frames.length ? frames : [frameFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height))], false, prompt);
    };
    stopRef.current = finish;
    timer = window.setInterval(() => {
      const elapsed = (performance.now() - started) / 1000;
      setSeconds(elapsed);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(frameFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height)));
      if (elapsed >= 8) finish();
    }, 125);
  }

  function stopRecord() {
    stopRef.current?.();
  }

  return (
    <section className="mb-4 border-t border-white/10 pt-3">
      <h2 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">Seen · {VISION_VERSION}</h2>
      <p className="mb-2 leading-relaxed text-white/45">
        A clip or a still becomes six numbers. A still does not pretend to move. Coupling 0 on the left is the official reading. Drop the picture and the body stays.
      </p>
      <label className="mb-2 block text-white/60">
        Prompt
        <select className="mt-1 w-full bg-black text-white" value={prompt} onChange={(event) => setPrompt(event.target.value)}>
          {PROMPTS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <div className="mb-3 flex flex-wrap gap-3">
        {recording ? (
          <button type="button" className="csc-link" onClick={stopRecord}>
            Stop {seconds.toFixed(1)}s
          </button>
        ) : (
          <button type="button" className="csc-link" onClick={() => void startRecord().catch(() => setError("The camera was not available."))}>
            Record
          </button>
        )}
        <button type="button" className="csc-link" onClick={() => fileRef.current?.click()} disabled={recording}>
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            void readFile(file)
              .then((result) => publish(result.frames, result.still, file.name))
              .catch(() => setError("That file could not be read."));
          }}
        />
      </div>
      <div className="mb-3 flex flex-wrap gap-3 text-white/50">
        {(
          [
            ["flat", "Flat"],
            ["checker", "Checker"],
            ["blink", "Blink"],
          ] as const
        ).map(([kind, name]) => (
          <button
            key={kind}
            type="button"
            className="csc-link"
            onClick={() => {
              const picture = testPicture(kind);
              publish(picture.frames, picture.still, `Test · ${name.toLowerCase()}`);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      {error && <p className="mb-2 text-white/80">{error}</p>}
      {reading && (
        <div className="mb-3">
          <p className="mb-1 text-white/50">
            {label} · {reading.frameCount} frame{reading.frameCount === 1 ? "" : "s"} · {reading.motionSource}
            {held ? " · picture held" : " · picture gone"}
          </p>
          <p className="mb-2 break-all text-[#cfff81]" data-genome-key={genomeKey(reading.genome)} data-motion-source={reading.motionSource}>
            {genomeKey(reading.genome)}
          </p>
          <table className="mb-2 w-full text-left text-white/75">
            <thead className="text-white/40">
              <tr>
                <th className="py-1 font-normal">Axis</th>
                <th className="py-1 font-normal">Raw</th>
                <th className="py-1 font-normal">Norm</th>
                <th className="py-1 font-normal">Quant</th>
              </tr>
            </thead>
            <tbody>
              {STRUCTURAL_AXES.map((axis) => (
                <tr key={axis}>
                  <td className="py-0.5">{axis}</td>
                  <td>{reading.axes[axis].raw.toFixed(2)}</td>
                  <td>{reading.axes[axis].normalized.toFixed(2)}</td>
                  <td>{reading.axes[axis].quantized.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mb-2 text-white/40">
            contrast {reading.contrast.toFixed(2)} · luma {reading.meanLuma.toFixed(2)} · delta {reading.meanDelta.toFixed(2)} · onsets{" "}
            {reading.onsets}
          </p>
          <button type="button" className="csc-link" disabled={!held} onClick={dropPicture}>
            Drop picture
          </button>
        </div>
      )}
      <h2 className="mb-2 mt-3 text-[10px] uppercase tracking-[0.2em] text-white/50">Birth for the right body</h2>
      <div className="mb-2 flex gap-3">
        {[0, 0.5, 1].map((value) => (
          <button
            key={value}
            type="button"
            className="csc-link"
            onClick={() => onCoupling(value)}
            style={{ color: Math.abs(coupling - value) < 0.001 ? "#cfff81" : undefined }}
          >
            coupling {value.toFixed(1)}
          </button>
        ))}
      </div>
      <MiniSlider label="density" value={birth.density} onChange={(density) => onBirth({ ...birth, density })} />
      <MiniSlider label="pulse" value={birth.pulse} onChange={(pulse) => onBirth({ ...birth, pulse })} />
      <MiniSlider label="tension" value={birth.tension} onChange={(tension) => onBirth({ ...birth, tension })} />
      <WordsPanel />
    </section>
  );
}

function MiniSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="mb-2 block">
      <span className="flex justify-between text-white/70">
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </span>
      <input className="w-full" type="range" min={0} max={1} step={0.01} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function frameFromImageData(image: ImageData): LumaFrame {
  const luma = new Float32Array(image.width * image.height);
  for (let i = 0; i < luma.length; i++) {
    const offset = i * 4;
    luma[i] = (0.2126 * image.data[offset] + 0.7152 * image.data[offset + 1] + 0.0722 * image.data[offset + 2]) / 255;
  }
  return { width: image.width, height: image.height, luma };
}

async function readFile(file: File): Promise<{ frames: LumaFrame[]; still: boolean }> {
  if (file.type.startsWith("video")) return { frames: await framesFromVideo(file), still: false };
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { frames: [frameFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height))], still: true };
}

async function framesFromVideo(file: File): Promise<LumaFrame[]> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("video"));
    });
    const duration = Math.min(8, Number.isFinite(video.duration) ? video.duration : 0);
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("canvas");
    const frames: LumaFrame[] = [];
    const steps = Math.max(1, Math.round(duration * 8));
    for (let i = 0; i < steps; i++) {
      video.currentTime = duration === 0 ? 0 : (i / steps) * duration;
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(frameFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height)));
    }
    return frames.length ? frames : [frameFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height))];
  } finally {
    URL.revokeObjectURL(url);
  }
}
