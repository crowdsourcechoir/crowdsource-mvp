"use client";

import { useEffect, useRef, useState } from "react";
import {
  ANALYSIS_VERSION,
  analyzePcm,
  deadAxes,
  defaultAnalysisConfig,
  testTone,
  type AnalysisConfig,
  type AnalysisReading,
} from "@/lib/song-garden-lab/analyze";
import { genomeKey } from "@/lib/song-garden-lab/quantize";
import { STRUCTURAL_AXES, type Conditions, type StructuralAxis } from "@/lib/song-garden-lab/types";

const STORAGE_KEY = "song-garden-lab-voice-v1";

const PROMPTS = [
  "Hold a tone",
  "Whisper",
  "Clap a rhythm",
  "Slide the pitch",
  "Leave a long silence",
  "Shout",
  "Hum a short leap",
];

type Take = {
  id: string;
  prompt: string;
  reading: AnalysisReading;
  hasAudio: boolean;
};

export default function VoicePanel({
  birth,
  onBirth,
  onReading,
}: {
  birth: Conditions;
  onBirth: (birth: Conditions) => void;
  onReading: (reading: AnalysisReading | null) => void;
}) {
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [takes, setTakes] = useState<Take[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [config, setConfig] = useState<AnalysisConfig>(() => defaultAnalysisConfig());
  const pcmRef = useRef<{ samples: Float32Array; sampleRate: number } | null>(null);
  const takesRef = useRef<Take[]>([]);
  const idRef = useRef(1);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopTimer = useRef<number | null>(null);
  const tickTimer = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const onReadingRef = useRef(onReading);
  onReadingRef.current = onReading;
  takesRef.current = takes;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Take[];
      if (!Array.isArray(parsed) || !parsed.length) return;
      const restored = parsed.map((take) => ({ ...take, hasAudio: false }));
      setTakes(restored);
      const last = restored[restored.length - 1];
      setActiveId(last.id);
      onReadingRef.current(last.reading);
      idRef.current =
        Math.max(
          0,
          ...restored.map((take) => Number(String(take.id).replace(/\D/g, "")) || 0)
        ) + 1;
    } catch {
      /* a broken session starts empty */
    }
  }, []);

  const active = takes.find((take) => take.id === activeId) ?? null;
  const dead = deadAxes(takes.map((take) => take.reading.genome), config.quantizeSteps);

  function remember(next: Take[]) {
    setTakes(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* the genome is still on screen */
    }
  }

  function adopt(reading: AnalysisReading, keepAudio: boolean) {
    const id = `t${String(idRef.current).padStart(2, "0")}`;
    idRef.current += 1;
    const prior = takesRef.current.find((take) => genomeKey(take.reading.genome) === genomeKey(reading.genome));
    const next = [
      ...takesRef.current.map((take) => ({ ...take, hasAudio: false })),
      { id, prompt, reading, hasAudio: keepAudio },
    ];
    remember(next);
    setActiveId(id);
    onReading(reading);
    setNote(prior ? `Same bytes as ${prior.id}.` : "Genome stored. The body can replay after the audio is gone.");
    setError("");
  }

  function runSamples(samples: Float32Array, sampleRate: number) {
    pcmRef.current = { samples, sampleRate };
    setBusy(true);
    window.setTimeout(() => {
      try {
        const reading = analyzePcm(samples, sampleRate, config);
        adopt(reading, true);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The take could not be read.");
      } finally {
        setBusy(false);
      }
    }, 20);
  }

  async function decodeBlob(blob: Blob) {
    const context = new AudioContext();
    try {
      const audio = await context.decodeAudioData(await blob.arrayBuffer());
      const mono = new Float32Array(audio.length);
      for (let channel = 0; channel < audio.numberOfChannels; channel++) {
        const data = audio.getChannelData(channel);
        for (let i = 0; i < audio.length; i++) mono[i] += data[i] / audio.numberOfChannels;
      }
      runSamples(mono, audio.sampleRate);
    } finally {
      await context.close();
    }
  }

  async function startRecord() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser has no microphone path. Use a test tone or import a file.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        void decodeBlob(blob).catch(() => setError("The recording could not be decoded."));
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setSeconds(0);
      const started = performance.now();
      tickTimer.current = window.setInterval(() => {
        setSeconds(Math.min(8, (performance.now() - started) / 1000));
      }, 100);
      stopTimer.current = window.setTimeout(() => stopRecord(), 8000);
    } catch {
      setError("The microphone was not available. Import a file or analyze a test tone.");
    }
  }

  function stopRecord() {
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    if (tickTimer.current) window.clearInterval(tickTimer.current);
    stopTimer.current = null;
    tickTimer.current = null;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    setRecording(false);
  }

  function reanalyze() {
    const pcm = pcmRef.current;
    if (!pcm || !active) return;
    setBusy(true);
    window.setTimeout(() => {
      try {
        const reading = analyzePcm(pcm.samples, pcm.sampleRate, config);
        const same = genomeKey(reading.genome) === genomeKey(active.reading.genome);
        const next = takesRef.current.map((take) => (take.id === active.id ? { ...take, reading, hasAudio: true } : take));
        remember(next);
        onReading(reading);
        setNote(same ? "Re-analysis matches the stored genome." : "The bounds changed the stored genome.");
      } finally {
        setBusy(false);
      }
    }, 20);
  }

  function dropAudio() {
    pcmRef.current = null;
    remember(takesRef.current.map((take) => ({ ...take, hasAudio: false })));
    setNote("The recording is gone. The body is the genome.");
  }

  function clearSession() {
    pcmRef.current = null;
    idRef.current = 1;
    remember([]);
    setActiveId(null);
    onReading(null);
    setNote("");
  }

  return (
    <section className="mb-4 border-t border-white/10 pt-3">
      <h2 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">Voice · {ANALYSIS_VERSION}</h2>
      <p className="mb-3 leading-relaxed text-white/55">
        Record up to eight seconds, or bring a file. The take is resampled to 16 kHz and quantized once. The left body is the
        official reading: birth at zero, coupling 0. The right body uses the birth below and the coupling in Laws.
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {PROMPTS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setPrompt(item)}
            className="rounded-full border px-2 py-1"
            style={{
              borderColor: prompt === item ? "#cfff81" : "rgba(255,255,255,0.2)",
              color: prompt === item ? "#111" : "#cfff81",
              background: prompt === item ? "#cfff81" : "transparent",
            }}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-3">
        {recording ? (
          <button type="button" className="csc-link" onClick={stopRecord}>
            Stop {seconds.toFixed(1)}s
          </button>
        ) : (
          <button type="button" className="csc-link" onClick={() => void startRecord()} disabled={busy}>
            Record
          </button>
        )}
        <button type="button" className="csc-link" onClick={() => fileRef.current?.click()} disabled={busy || recording}>
          Import
        </button>
        <button
          type="button"
          className="csc-link"
          disabled={busy || recording}
          onClick={() => runSamples(testTone("leap"), 16000)}
        >
          Analyze test tone
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            void decodeBlob(file).catch(() => setError("That file could not be decoded."));
          }}
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-3 text-white/50">
        {(
          [
            ["steady", "Steady"],
            ["bright", "Bright"],
            ["bursts", "Claps"],
            ["silence", "Silence"],
          ] as const
        ).map(([kind, label]) => (
          <button key={kind} type="button" className="csc-link" disabled={busy || recording} onClick={() => runSamples(testTone(kind), 16000)}>
            {label}
          </button>
        ))}
      </div>

      {busy && <p className="mb-2 text-[#cfff81]">Reading the take…</p>}
      {error && <p className="mb-2 text-white/80">{error}</p>}
      {note && <p className="mb-2 text-white/70">{note}</p>}

      {active && (
        <div className="mb-3">
          <p className="mb-1 text-white/50">
            {active.id} · {active.prompt} · {active.reading.durationSec.toFixed(2)}s · {active.reading.motionSource}
            {active.hasAudio ? " · audio held" : " · audio gone"}
          </p>
          <p className="mb-2 break-all text-[#cfff81]" data-genome-key={genomeKey(active.reading.genome)} data-motion-source={active.reading.motionSource}>
            {genomeKey(active.reading.genome)}
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
                  <td>{formatRaw(axis, active.reading)}</td>
                  <td>{active.reading.axes[axis].normalized.toFixed(2)}</td>
                  <td>{active.reading.axes[axis].quantized.toFixed(2)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-0.5">register</td>
                <td>{active.reading.register.raw.toFixed(2)}</td>
                <td>{active.reading.register.normalized.toFixed(2)}</td>
                <td>{active.reading.register.quantized.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mb-2 text-white/40">
            pitch confidence {active.reading.pitchConfidence.raw.toFixed(2)} · onsets {active.reading.onsets} · centroid{" "}
            {Math.round(active.reading.centroidHz)} Hz
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="csc-link" disabled={!active.hasAudio || busy} onClick={reanalyze}>
              Re-analyze
            </button>
            <button type="button" className="csc-link" disabled={!active.hasAudio || busy} onClick={dropAudio}>
              Drop audio
            </button>
          </div>
        </div>
      )}

      <h2 className="mb-2 mt-3 text-[10px] uppercase tracking-[0.2em] text-white/50">Birth for the right body</h2>
      <MiniSlider label="density" value={birth.density} onChange={(density) => onBirth({ ...birth, density })} />
      <MiniSlider label="pulse" value={birth.pulse} onChange={(pulse) => onBirth({ ...birth, pulse })} />
      <MiniSlider label="tension" value={birth.tension} onChange={(tension) => onBirth({ ...birth, tension })} />

      {takes.length > 0 && (
        <div className="mt-3">
          <h2 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">Session</h2>
          <ol className="mb-3 space-y-1">
            {takes.map((take) => (
              <li key={take.id}>
                <button
                  type="button"
                  className="text-left"
                  style={{ color: take.id === activeId ? "#cfff81" : "rgba(255,255,255,0.7)" }}
                  onClick={() => {
                    setActiveId(take.id);
                    onReading(take.reading);
                    setNote(take.hasAudio ? "" : "Stored genome. This take has no audio in the lab.");
                  }}
                >
                  {take.id} · {take.prompt} · force {take.reading.genome.force.toFixed(2)}
                </button>
              </li>
            ))}
          </ol>
          <div className="space-y-2">
            {STRUCTURAL_AXES.map((axis) => (
              <div key={axis}>
                <div className="mb-0.5 flex justify-between text-white/45">
                  <span>{axis}</span>
                  {dead.includes(axis) ? <span className="text-[#cfff81]">dead wire</span> : <span />}
                </div>
                <div className="relative h-2 bg-white/10">
                  {takes.map((take) => (
                    <span
                      key={take.id}
                      className="absolute top-0 h-2 w-px bg-[#cfff81]"
                      style={{ left: `${take.reading.genome[axis] * 100}%` }}
                      title={take.id}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="csc-link mt-3" onClick={clearSession}>
            Clear session
          </button>
        </div>
      )}

      <details className="mt-3 text-white/60">
        <summary className="cursor-pointer text-white/50">Normalization bounds</summary>
        <p className="my-2 leading-relaxed">Fixed bounds. They are never fit to this session. Re-analyze applies them to the held audio.</p>
        <MiniSlider
          label="force floor dB"
          value={config.forceDbMin}
          min={-80}
          max={-20}
          step={1}
          onChange={(forceDbMin) => setConfig((current) => ({ ...current, forceDbMin }))}
        />
        <MiniSlider
          label="force ceiling dB"
          value={config.forceDbMax}
          min={-40}
          max={0}
          step={1}
          onChange={(forceDbMax) => setConfig((current) => ({ ...current, forceDbMax }))}
        />
        <MiniSlider
          label="pitch gate"
          value={config.pitchGate}
          onChange={(pitchGate) => setConfig((current) => ({ ...current, pitchGate }))}
        />
        <MiniSlider
          label="flux bound"
          value={config.fluxBound}
          max={4}
          step={0.05}
          onChange={(fluxBound) => setConfig((current) => ({ ...current, fluxBound }))}
        />
        <MiniSlider
          label="onsets at full"
          value={config.articulationPerSec}
          max={16}
          step={0.5}
          onChange={(articulationPerSec) => setConfig((current) => ({ ...current, articulationPerSec }))}
        />
        <div className="mt-2 flex gap-3">
          {[15, 31, 63].map((steps) => (
            <button
              key={steps}
              type="button"
              className="csc-link"
              onClick={() => setConfig((current) => ({ ...current, quantizeSteps: steps }))}
              style={{ color: config.quantizeSteps === steps ? "#cfff81" : undefined }}
            >
              {steps + 1} steps
            </button>
          ))}
        </div>
      </details>
    </section>
  );
}

function formatRaw(axis: StructuralAxis, reading: AnalysisReading): string {
  const raw = reading.axes[axis].raw;
  if (axis === "force") return `${raw.toFixed(1)} dB`;
  if (axis === "sustain") return `${raw.toFixed(2)} s`;
  if (axis === "brightness") return `${Math.round(raw)} Hz`;
  if (axis === "articulation") return `${raw.toFixed(2)} /s`;
  if (axis === "motion") return reading.motionSource === "pitch" ? `${raw.toFixed(1)} st` : raw.toFixed(2);
  return raw.toFixed(2);
}

function MiniSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="mb-2 block">
      <span className="flex justify-between text-white/70">
        <span>{label}</span>
        <span>{value.toFixed(step >= 1 ? 0 : 2)}</span>
      </span>
      <input
        className="w-full"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
