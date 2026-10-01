"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisReading } from "@/lib/song-garden-lab/analyze";
import { depositOf } from "@/lib/song-garden-lab/conditions";
import { drawGarden, type DrawHit } from "@/lib/song-garden-lab/draw";
import { expressChannels } from "@/lib/song-garden-lab/express";
import { foldLog, organismFrom } from "@/lib/song-garden-lab/fold";
import { haltonGenomes, publishedField, type NamedGenome } from "@/lib/song-garden-lab/genomes";
import { realizeRibbon } from "@/lib/song-garden-lab/grammar";
import { ribbonHash } from "@/lib/song-garden-lab/hash";
import { defaultLaws, zeroConditions } from "@/lib/song-garden-lab/laws";
import { live } from "@/lib/song-garden-lab/live";
import type { Conditions, Genome, Laws, Organism, StructuralAxis } from "@/lib/song-garden-lab/types";
import { STRUCTURAL_AXES } from "@/lib/song-garden-lab/types";
import VoicePanel from "@/components/song-garden-lab/VoicePanel";

type Mode = "one" | "sheet" | "field" | "voice";

const SHEET = haltonGenomes(30);
const FIELD_SEED = publishedField();

function cloneGenome(genome: Genome): Genome {
  return { ...genome };
}

function sameStructure(organism: Organism, laws: Laws): boolean {
  const birth = organism.birthConditions;
  const once = ribbonHash(realizeRibbon(organism.genome, expressChannels(organism.genome, birth, laws), laws));
  const twice = ribbonHash(realizeRibbon(organism.genome, expressChannels(organism.genome, birth, laws), laws));
  return once === twice && once === ribbonHash(organism.ribbon);
}

export default function GardenLab() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitsRef = useRef<DrawHit[]>([]);
  const [mode, setMode] = useState<Mode>("field");
  const [laws, setLaws] = useState<Laws>(() => defaultLaws());
  const [solo, setSolo] = useState<Genome>(() => cloneGenome(SHEET[3].genome));
  const [birth, setBirth] = useState<Conditions>(() => zeroConditions());
  const [field, setField] = useState<NamedGenome[]>(() =>
    FIELD_SEED.map((item) => ({ id: item.id, genome: cloneGenome(item.genome) }))
  );
  const [selectedId, setSelectedId] = useState("h04");
  const [growEpoch, setGrowEpoch] = useState(0);
  const [frameMs, setFrameMs] = useState(0);
  const [voiceReading, setVoiceReading] = useState<AnalysisReading | null>(null);

  const sheetLaws = useMemo(
    () => defaultLaws({ ...laws, coupling: 0, mute: { density: true, pulse: true, tension: true } }),
    [laws]
  );

  const sheetOrganisms = useMemo(() => foldLog(SHEET, sheetLaws).organisms, [sheetLaws]);

  const soloOrganism = useMemo(() => {
    const deposit = depositOf(solo, birth, laws);
    return organismFrom("solo", solo, birth, deposit, [], laws);
  }, [solo, birth, laws]);

  const fieldFold = useMemo(() => foldLog(field, laws), [field, laws]);

  const officialLaws = useMemo(() => defaultLaws({ ...laws, coupling: 0 }), [laws]);

  const voiceOrganisms = useMemo(() => {
    if (!voiceReading) return [];
    const genome = voiceReading.genome;
    const origin = zeroConditions();
    const atZero = organismFrom(
      "at zero",
      genome,
      origin,
      depositOf(genome, origin, officialLaws),
      [],
      officialLaws
    );
    const inLab = organismFrom("in lab", genome, birth, depositOf(genome, birth, laws), [], laws);
    atZero.position = { x: 0.32, y: 0.78 };
    inLab.position = { x: 0.68, y: 0.78 };
    return [atZero, inLab];
  }, [voiceReading, birth, laws, officialLaws]);

  const organisms: Organism[] =
    mode === "sheet" ? sheetOrganisms : mode === "one" ? [soloOrganism] : mode === "voice" ? voiceOrganisms : fieldFold.organisms;

  const selected = organisms.find((organism) => organism.id === selectedId) ?? organisms[0] ?? null;
  const structureStable = selected ? sameStructure(selected, mode === "sheet" ? sheetLaws : laws) : false;
  const behavior = selected ? live(selected, selected.birthConditions, [], laws) : null;

  const drawRef = useRef({ organisms, laws, mode, selectedId: selected?.id ?? null });
  drawRef.current = { organisms, laws, mode, selectedId: selected?.id ?? null };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let last = performance.now();
    const started = performance.now();
    const samples: number[] = [];

    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      samples.push(delta);
      if (samples.length > 30) samples.shift();
      const parent = canvas.parentElement;
      const width = parent?.clientWidth ?? 800;
      const height = parent?.clientHeight ?? 600;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const current = drawRef.current;
      hitsRef.current = drawGarden(ctx, current.organisms, {
        width,
        height,
        time: (now - started) / 1000,
        grow: Math.min(1, (now - started) / 2000),
        laws: current.laws,
        selectedId: current.selectedId,
        layout: current.mode === "sheet" ? "sheet" : "field",
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const meter = window.setInterval(() => {
      if (!samples.length) return;
      const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      setFrameMs(avg);
    }, 500);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(meter);
    };
  }, [growEpoch, mode]);

  function patchLaws(patch: Partial<Laws>) {
    setLaws((current) => defaultLaws({ ...current, ...patch }));
  }

  function moveField(index: number, direction: -1 | 1) {
    setField((current) => {
      const next = current.slice();
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
    setGrowEpoch((n) => n + 1);
  }

  function onCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let best: DrawHit | null = null;
    let bestDist = 56;
    for (const hit of hitsRef.current) {
      const dist = Math.hypot(hit.x - x, hit.y - y);
      if (dist < bestDist) {
        best = hit;
        bestDist = dist;
      }
    }
    if (best) setSelectedId(best.id);
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-black text-white md:flex-row">
      <div className="relative min-h-[52dvh] flex-1 md:min-h-0">
        <canvas ref={canvasRef} onClick={onCanvasClick} className="h-full w-full cursor-pointer" />
        <p className="pointer-events-none absolute left-4 top-3 font-mono text-[11px] tracking-wide text-[#cfff81]/80">
          Garden lab · draft {laws.rulesVersion}
        </p>
      </div>
      <aside className="h-[48dvh] overflow-y-auto border-t border-white/10 px-4 py-3 font-mono text-[11px] md:h-full md:w-[360px] md:shrink-0 md:border-l md:border-t-0">
        <div className="mb-3 flex gap-2">
          {(
            [
              ["voice", "Voice"],
              ["one", "One"],
              ["sheet", "Sheet"],
              ["field", "Field"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMode(id);
                setGrowEpoch((n) => n + 1);
                setSelectedId(id === "one" ? "solo" : id === "voice" ? "at zero" : "h04");
              }}
              className="rounded-full border px-3 py-1"
              style={{
                borderColor: mode === id ? "#cfff81" : "rgba(255,255,255,0.2)",
                color: mode === id ? "#111" : "#cfff81",
                background: mode === id ? "#cfff81" : "transparent",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mb-3 leading-relaxed text-white/55">
          {mode === "voice" && "A recording becomes six numbers. Coupling 0 on the left is the official reading of the gesture."}
          {mode === "one" && "One genome against a birth you set. Zero birth is the pure gesture."}
          {mode === "sheet" && "Thirty genomes, each born at zero. This is the family, before the garden has a history."}
          {mode === "field" && "Twelve planted in order onto one ground. Coupling 0 leaves them as themselves. Raise it to let birth conditions lean the later ones."}
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button type="button" className="csc-link" onClick={() => setGrowEpoch((n) => n + 1)}>
            Grow again
          </button>
          <span className="text-white/40">{frameMs ? `${frameMs.toFixed(1)} ms/frame` : ""}</span>
        </div>

        {selected && (
          <section className="mb-4 border-t border-white/10 pt-3">
            <h2 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">{selected.id}</h2>
            <p className="text-[#cfff81]">
              hash {ribbonHash(selected.ribbon)} · {structureStable ? "replay matches" : "replay drifted"}
            </p>
            <p className="mt-1 text-white/70">
              arm {selected.expressed.secondaryArm ? "yes" : "no"} · resistance {selected.expressed.resistance.toFixed(2)} ·
              felt coupling {selected.expressed.effectiveCoupling.toFixed(2)}
            </p>
            <p className="text-white/50">
              scale {selected.expressed.scale.toFixed(2)} · bend {selected.expressed.curvature.toFixed(2)} · period{" "}
              {selected.motion.periodSec.toFixed(1)}s · sway {behavior ? behavior.swayAmplitude.toFixed(2) : "0"}
            </p>
            <p className="text-white/40">
              birth density {selected.birthConditions.density.toFixed(3)} · pulse {selected.birthConditions.pulse.toFixed(3)} ·
              tension {selected.birthConditions.tension.toFixed(3)}
            </p>
            {mode === "voice" && (
              <p className="text-white/40">
                source {selected.genome.motionSource} · register {selected.genome.register.toFixed(2)}
              </p>
            )}
          </section>
        )}

        {mode === "voice" && (
          <VoicePanel
            birth={birth}
            coupling={laws.coupling}
            onBirth={setBirth}
            onCoupling={(coupling) => patchLaws({ coupling })}
            onReading={(reading) => {
              setVoiceReading(reading);
              setSelectedId("at zero");
              setGrowEpoch((n) => n + 1);
            }}
          />
        )}

        {mode === "one" && (
          <section className="mb-4">
            <h2 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">Genome</h2>
            {STRUCTURAL_AXES.map((axis) => (
              <LawSlider
                key={axis}
                label={axis}
                value={solo[axis]}
                step={1 / 63}
                onChange={(value) => {
                  setSolo((current) => ({ ...current, [axis]: value }));
                  setGrowEpoch((n) => n + 1);
                }}
              />
            ))}
            <h2 className="mb-2 mt-3 text-[10px] uppercase tracking-[0.2em] text-white/50">Birth conditions</h2>
            <LawSlider label="density" value={birth.density} onChange={(density) => setBirth((current) => ({ ...current, density }))} />
            <LawSlider label="pulse" value={birth.pulse} onChange={(pulse) => setBirth((current) => ({ ...current, pulse }))} />
            <LawSlider
              label="tension"
              value={birth.tension}
              onChange={(tension) => setBirth((current) => ({ ...current, tension }))}
            />
          </section>
        )}

        <section className="mb-4 border-t border-white/10 pt-3">
          <h2 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">Laws</h2>
          <LawSlider label="coupling" value={laws.coupling} onChange={(coupling) => patchLaws({ coupling })} />
          <LawSlider label="force knee" value={laws.forceKnee} onChange={(forceKnee) => patchLaws({ forceKnee })} />
          <div className="mb-2 flex gap-3">
            {[0, 0.5, 1].map((value) => (
              <button key={value} type="button" className="csc-link" onClick={() => patchLaws({ coupling: value })}>
                {value.toFixed(1)}
              </button>
            ))}
          </div>
          <LawSlider
            label="curvature scale"
            value={laws.curvatureScale}
            max={2.5}
            onChange={(curvatureScale) => patchLaws({ curvatureScale })}
          />
          <LawSlider label="length" value={laws.lengthScale} max={1.8} onChange={(lengthScale) => patchLaws({ lengthScale })} />
          <LawSlider label="width" value={laws.widthScale} max={2} onChange={(widthScale) => patchLaws({ widthScale })} />
          <LawSlider
            label="sway"
            value={laws.swayAmplitude}
            max={0.25}
            onChange={(swayAmplitude) => patchLaws({ swayAmplitude })}
          />
          <Toggle label="sway on" on={laws.swayEnabled} onChange={(swayEnabled) => patchLaws({ swayEnabled })} />
          <Toggle label="labels" on={laws.showLabels} onChange={(showLabels) => patchLaws({ showLabels })} />
          <Toggle label="linear foil" on={laws.linearFoil} onChange={(linearFoil) => patchLaws({ linearFoil })} />
          <Toggle
            label="tension may add an arm"
            on={laws.branchFromTension}
            onChange={(branchFromTension) => patchLaws({ branchFromTension })}
          />
          <Toggle
            label="centered pull"
            on={laws.originMode === "centered"}
            onChange={(on) => patchLaws({ originMode: on ? "centered" : "pure" })}
          />
          <Toggle
            label="mute density"
            on={laws.mute.density}
            onChange={(density) => patchLaws({ mute: { ...laws.mute, density } })}
          />
          <Toggle label="mute pulse" on={laws.mute.pulse} onChange={(pulse) => patchLaws({ mute: { ...laws.mute, pulse } })} />
          <Toggle
            label="mute tension"
            on={laws.mute.tension}
            onChange={(tension) => patchLaws({ mute: { ...laws.mute, tension } })}
          />
        </section>

        {mode === "field" && (
          <section className="mb-4 border-t border-white/10 pt-3">
            <h2 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">History</h2>
            <p className="mb-2 text-white/50">
              garden density {fieldFold.conditions.density.toFixed(3)} · pulse {fieldFold.conditions.pulse.toFixed(3)} ·
              tension {fieldFold.conditions.tension.toFixed(3)}
            </p>
            <ol className="space-y-1">
              {field.map((entry, index) => {
                const organism = fieldFold.organisms.find((item) => item.id === entry.id);
                const active = entry.id === selected?.id;
                return (
                  <li key={entry.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(entry.id)}
                      className="flex-1 text-left"
                      style={{ color: active ? "#cfff81" : "rgba(255,255,255,0.7)" }}
                    >
                      {index + 1}. {entry.id}
                      {organism ? ` · bend ${organism.expressed.curvature.toFixed(2)}` : ""}
                    </button>
                    <button type="button" className="px-1 text-white/40" onClick={() => moveField(index, -1)} aria-label="Earlier">
                      ↑
                    </button>
                    <button type="button" className="px-1 text-white/40" onClick={() => moveField(index, 1)} aria-label="Later">
                      ↓
                    </button>
                  </li>
                );
              })}
            </ol>
            <button
              type="button"
              className="csc-link mt-3"
              onClick={() => {
                setField(FIELD_SEED.map((item) => ({ id: item.id, genome: cloneGenome(item.genome) })));
                setGrowEpoch((n) => n + 1);
              }}
            >
              Reset order
            </button>
          </section>
        )}
      </aside>
    </div>
  );
}

function LawSlider({
  label,
  value,
  onChange,
  max = 1,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
  step?: number;
}) {
  return (
    <label className="mb-2 block">
      <span className="flex justify-between text-white/70">
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </span>
      <input
        className="w-full"
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="mb-1 flex items-center gap-2 text-white/70">
      <input type="checkbox" checked={on} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}
