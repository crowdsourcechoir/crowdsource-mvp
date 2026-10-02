"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisReading } from "@/lib/song-garden-lab/analyze";
import {
  SHORT_B_ORDER,
  SUBJECT_ID,
  WORLD_B_ORDER,
  compareFolds,
  permuteField,
} from "@/lib/song-garden-lab/compare";
import { foldSteps, plantedSteps, scaleConditions, type LogStep } from "@/lib/song-garden-lab/compost";
import { depositOf } from "@/lib/song-garden-lab/conditions";
import ComparePanel, { type CompareSpan, type CompareView } from "@/components/song-garden-lab/ComparePanel";
import { drawCompare, drawGarden, type DrawHit } from "@/lib/song-garden-lab/draw";
import { expressChannels } from "@/lib/song-garden-lab/express";
import { foldLog, organismFrom } from "@/lib/song-garden-lab/fold";
import { haltonGenomes, publishedField } from "@/lib/song-garden-lab/genomes";
import { realizeRibbon } from "@/lib/song-garden-lab/grammar";
import { ribbonHash } from "@/lib/song-garden-lab/hash";
import { defaultLaws, zeroConditions } from "@/lib/song-garden-lab/laws";
import { live } from "@/lib/song-garden-lab/live";
import { noteName, sounding } from "@/lib/song-garden-lab/sound";
import SoundBed from "@/components/song-garden-lab/SoundBed";
import type { Conditions, Genome, Laws, Organism, StructuralAxis } from "@/lib/song-garden-lab/types";
import { STRUCTURAL_AXES } from "@/lib/song-garden-lab/types";
import SeenPanel from "@/components/song-garden-lab/SeenPanel";
import VoicePanel from "@/components/song-garden-lab/VoicePanel";
import WordsPanel from "@/components/song-garden-lab/WordsPanel";
import type { VisionReading } from "@/lib/song-garden-lab/vision";

type Mode = "one" | "sheet" | "field" | "voice" | "compare" | "seen";

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

export default function GardenLab({ embedded = false }: { embedded?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitsRef = useRef<DrawHit[]>([]);
  const [mode, setMode] = useState<Mode>("field");
  const [laws, setLaws] = useState<Laws>(() => defaultLaws());
  const [solo, setSolo] = useState<Genome>(() => cloneGenome(SHEET[3].genome));
  const [birth, setBirth] = useState<Conditions>(() => zeroConditions());
  const [field, setField] = useState<LogStep[]>(() => plantedSteps(FIELD_SEED));
  const [moment, setMoment] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState("h04");
  const [growEpoch, setGrowEpoch] = useState(0);
  const [frameMs, setFrameMs] = useState(0);
  const [voiceReading, setVoiceReading] = useState<AnalysisReading | null>(null);
  const [visionReading, setVisionReading] = useState<VisionReading | null>(null);
  const [compareView, setCompareView] = useState<CompareView>("both");
  const [compareSpan, setCompareSpan] = useState<CompareSpan>("twelve");
  const [soundOn, setSoundOn] = useState(false);
  const [timePassing, setTimePassing] = useState(false);
  const tickSerial = useRef(0);

  const sheetLaws = useMemo(
    () => defaultLaws({ ...laws, coupling: 0, mute: { density: true, pulse: true, tension: true } }),
    [laws]
  );

  const sheetOrganisms = useMemo(() => foldLog(SHEET, sheetLaws).organisms, [sheetLaws]);

  const soloOrganism = useMemo(() => {
    const deposit = depositOf(solo, birth, laws);
    return organismFrom("solo", solo, birth, deposit, [], laws);
  }, [solo, birth, laws]);

  const shownField = useMemo(() => (moment == null ? field : field.slice(0, moment)), [field, moment]);
  const fieldFold = useMemo(() => foldSteps(shownField, laws), [shownField, laws]);

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

  const seenOrganisms = useMemo(() => {
    if (!visionReading) return [];
    const genome = visionReading.genome;
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
  }, [visionReading, birth, laws, officialLaws]);

  const orderA = useMemo(
    () => (compareSpan === "four" ? FIELD_SEED.slice(0, 4) : FIELD_SEED),
    [compareSpan]
  );
  const orderB = useMemo(
    () => permuteField(orderA, compareSpan === "four" ? SHORT_B_ORDER : WORLD_B_ORDER),
    [orderA, compareSpan]
  );
  const foldA = useMemo(() => foldLog(orderA, laws), [orderA, laws]);
  const foldB = useMemo(() => foldLog(orderB, laws), [orderB, laws]);
  const focusId = foldA.organisms.some((organism) => organism.id === selectedId) ? selectedId : SUBJECT_ID;
  const compareReport = useMemo(() => compareFolds(foldA, foldB, focusId), [foldA, foldB, focusId]);
  const pairOrganisms = useMemo(() => {
    const left = foldA.organisms.find((organism) => organism.id === focusId);
    const right = foldB.organisms.find((organism) => organism.id === focusId);
    if (!left || !right) return [];
    return [
      { ...left, position: { x: 0.32, y: 0.78 } },
      { ...right, position: { x: 0.68, y: 0.78 } },
    ];
  }, [foldA, foldB, focusId]);

  const soundConditions: Conditions =
    mode === "field"
      ? fieldFold.conditions
      : mode === "compare"
        ? compareView === "b"
          ? foldB.conditions
          : foldA.conditions
        : mode === "sheet"
          ? zeroConditions()
          : birth;

  const organisms: Organism[] =
    mode === "sheet"
      ? sheetOrganisms
      : mode === "one"
        ? [soloOrganism]
        : mode === "voice"
          ? voiceOrganisms
          : mode === "seen"
            ? seenOrganisms
            : mode === "compare"
            ? compareView === "pair"
              ? pairOrganisms
              : compareView === "b"
                ? foldB.organisms
                : foldA.organisms
            : fieldFold.organisms;

  const soundFrame = useMemo(
    () => sounding(organisms, soundConditions, laws),
    [organisms, soundConditions, laws]
  );

  const selected =
    organisms.find((organism) => organism.id === selectedId) ??
    (mode === "field" ? fieldFold.remnants.find((organism) => organism.id === selectedId) : undefined) ??
    organisms[0] ??
    null;
  const structureStable = selected ? sameStructure(selected, mode === "sheet" ? sheetLaws : laws) : false;
  const behavior = selected ? live(selected, selected.birthConditions, [], laws) : null;

  const drawRef = useRef({
    organisms,
    laws,
    mode,
    selectedId: selected?.id ?? null as string | null,
    compareView,
    worldA: foldA.organisms,
    worldB: foldB.organisms,
    pair: pairOrganisms,
    remnants: [] as Organism[],
  });
  drawRef.current = {
    organisms,
    laws,
    mode,
    selectedId: mode === "compare" ? focusId : (selected?.id ?? null),
    compareView,
    worldA: foldA.organisms,
    worldB: foldB.organisms,
    pair: pairOrganisms,
    remnants: laws.showRemnants ? fieldFold.remnants : [],
  };

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
      const frameOptions = {
        width,
        height,
        time: (now - started) / 1000,
        grow: Math.min(1, (now - started) / 2000),
        laws: current.laws,
        selectedId: current.selectedId,
      };
      if (current.mode === "compare" && current.compareView === "both") {
        hitsRef.current = drawCompare(
          ctx,
          [
            { label: "A", organisms: current.worldA },
            { label: "B", organisms: current.worldB },
          ],
          frameOptions
        );
      } else if (current.mode === "compare" && current.compareView === "pair") {
        hitsRef.current = drawGarden(ctx, current.pair, {
          ...frameOptions,
          layout: "field",
          marks: [
            { x: 0.32, text: "A" },
            { x: 0.68, text: "B" },
          ],
        });
      } else if (current.mode === "compare" && current.compareView === "b") {
        hitsRef.current = drawGarden(ctx, current.worldB, { ...frameOptions, layout: "field" });
      } else {
        hitsRef.current = drawGarden(ctx, current.organisms, {
          ...frameOptions,
          layout: current.mode === "sheet" ? "sheet" : "field",
          remnants: current.mode === "field" ? current.remnants : [],
        });
      }
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

  useEffect(() => {
    if (mode !== "compare") return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      const sweep: Record<string, number> = { "1": 0, "2": 0.25, "3": 0.5, "4": 0.75, "5": 1 };
      if (event.key in sweep) {
        patchLaws({
          coupling: sweep[event.key],
          branchFromTension: false,
          leak: { density: 0, pulse: 0, tension: 0 },
        });
        setGrowEpoch((n) => n + 1);
        return;
      }
      if (event.key === "a" || event.key === "A") setCompareView("a");
      if (event.key === "b" || event.key === "B") setCompareView("b");
      if (event.key === "0" || event.key === "Escape") setCompareView("both");
      if (event.key === "p" || event.key === "P") {
        setCompareView("pair");
        setGrowEpoch((n) => n + 1);
      }
      if (event.key === "l" || event.key === "L") {
        setLaws((current) => defaultLaws({ ...current, showLabels: !current.showLabels }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  useEffect(() => {
    if (mode !== "field") setTimePassing(false);
  }, [mode]);

  useEffect(() => {
    if (!timePassing || mode !== "field" || moment !== null) return;
    const id = window.setInterval(() => {
      tickSerial.current += 1;
      const stepId = `tick-${tickSerial.current}`;
      setField((current) => [...current, { id: stepId, type: "tick" }]);
    }, 1000);
    return () => window.clearInterval(id);
  }, [timePassing, mode, moment]);

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

  function returnSelected() {
    const organism = fieldFold.organisms.find((item) => item.id === selectedId);
    if (!organism) return;
    if (field.some((step) => step.type === "compost" && step.organismId === organism.id)) return;
    const step: LogStep = {
      id: `return-${organism.id}`,
      type: "compost",
      organismId: organism.id,
      returns: scaleConditions(organism.deposit, laws.compostFraction),
    };
    setField((current) => [...current, step]);
    setMoment(null);
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
    <div className={`flex flex-col overflow-hidden bg-black text-white md:flex-row ${embedded ? "h-full" : "h-[100dvh]"}`}>
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
              ["compare", "A/B"],
              ["voice", "Voice"],
              ["seen", "Seen"],
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
                setSelectedId(id === "one" ? "solo" : id === "voice" || id === "seen" ? "at zero" : SUBJECT_ID);
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
          {mode === "compare" && "Two orders of the same genomes. The dot is the contribution to find. Coupling 0 keeps each body on its own gesture."}
          {mode === "voice" && "A recording becomes six numbers. Coupling 0 on the left is the official reading of the gesture."}
          {mode === "seen" && "A picture becomes six numbers. A still does not move. Coupling 0 on the left is the official reading."}
          {mode === "one" && "One genome against a birth you set. Zero birth is the pure gesture."}
          {mode === "sheet" && "Thirty genomes, each born at zero. This is the family, before the garden has a history."}
          {mode === "field" && "Twelve planted in order. Return gives part of a deposit back to the ground and takes that body off the living set. The planting stays in the log."}
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button type="button" className="csc-link" onClick={() => setGrowEpoch((n) => n + 1)}>
            Grow again
          </button>
          <button type="button" className="csc-link" onClick={() => setSoundOn((on) => !on)}>
            {soundOn ? "Sound off" : "Sound"}
          </button>
          <span className="text-white/40">{frameMs ? `${frameMs.toFixed(1)} ms/frame` : ""}</span>
        </div>

        <section className="mb-4 border-t border-white/10 pt-3">
          <h2 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">Sound</h2>
          <p className="mb-2 leading-relaxed text-white/45">
            Density caps the air. Pulse is the tempo. Tension is how far each stored register sits from{" "}
            {noteName(soundFrame.centerMidi)}. The speakers play this reading.
          </p>
          <p className="text-white/60" data-sound-reading="">
            {soundOn ? "sound on" : "sound off"} · thickness {soundFrame.thickness.toFixed(3)} · tempo{" "}
            {soundFrame.tempoHz.toFixed(2)} Hz ·{" "}
            {soundFrame.voices.length === 0
              ? "no voices"
              : soundFrame.voices.every((voice) => Math.abs(voice.midi - soundFrame.voices[0].midi) < 0.05)
                ? `one pitch ${noteName(soundFrame.voices[0].midi)}`
                : `${soundFrame.voices.length} pitches`}
          </p>
        </section>
        <SoundBed enabled={soundOn} frame={soundFrame} />

        {selected && mode !== "compare" && (
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
            {(mode === "voice" || mode === "seen") && (
              <p className="text-white/40">
                source {selected.genome.motionSource} · register {selected.genome.register.toFixed(2)}
              </p>
            )}
            {mode === "field" && fieldFold.remnants.some((organism) => organism.id === selected.id) && (
              <p className="text-white/50">Returned. The planting is still in the log.</p>
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
        {mode === "voice" && <WordsPanel />}

        {mode === "seen" && (
          <SeenPanel
            birth={birth}
            coupling={laws.coupling}
            onBirth={setBirth}
            onCoupling={(coupling) => patchLaws({ coupling })}
            onReading={(reading) => {
              setVisionReading(reading);
              setSelectedId("at zero");
              setGrowEpoch((n) => n + 1);
            }}
          />
        )}

        {mode === "compare" && (
          <ComparePanel
            report={compareReport}
            view={compareView}
            span={compareSpan}
            laws={laws}
            onView={(next) => {
              setCompareView(next);
              setGrowEpoch((n) => n + 1);
            }}
            onSpan={(next) => {
              setCompareSpan(next);
              setSelectedId(SUBJECT_ID);
              setGrowEpoch((n) => n + 1);
            }}
            onSweep={(coupling) => {
              patchLaws({
                coupling,
                branchFromTension: false,
                leak: { density: 0, pulse: 0, tension: 0 },
              });
              setGrowEpoch((n) => n + 1);
            }}
            onBoundary={() => {
              patchLaws({
                coupling: 0.5,
                branchFromTension: true,
                leak: { density: 0, pulse: 0, tension: 0 },
              });
              setGrowEpoch((n) => n + 1);
            }}
            onHear={(which) =>
              patchLaws({
                mute: {
                  density: which === "tension",
                  pulse: which !== "all",
                  tension: which === "density",
                },
              })
            }
            onLaws={patchLaws}
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
              tension {fieldFold.conditions.tension.toFixed(3)} · living {fieldFold.organisms.length}
            </p>
            <p className="mb-2 leading-relaxed text-white/45">
              A return is a fraction of that body&apos;s own deposit, added through the same diminishing fill. The fraction applies when you return a body. It is not a refund.
              The number beside each planting is the tension it was born into. Coupling, above, is what lets that tension bend the ribbon.
              Leak thins the ground after every event, including a return.
            </p>
            <LawSlider
              label="return fraction"
              value={laws.compostFraction}
              onChange={(compostFraction) => patchLaws({ compostFraction })}
            />
            <LawSlider
              label="leak"
              value={laws.leak.density}
              max={0.2}
              onChange={(leak) => patchLaws({ leak: { density: leak, pulse: leak, tension: leak } })}
            />
            <button
              type="button"
              className="csc-link mb-3 disabled:opacity-40"
              disabled={laws.leak.density === 0 && laws.leak.pulse === 0 && laws.leak.tension === 0}
              onClick={() => setTimePassing((passing) => !passing)}
            >
              {timePassing ? "Hold time" : "Let time pass"}
            </button>
            <p className="mb-2 text-white/45">
              {timePassing
                ? "Each second is an event. The living bodies stay. The ground thins, and the next birth hears it."
                : "Raise leak, then let time pass. Moving leak recomputes every event already in the log. At zero, a second changes nothing."}
            </p>
            <Toggle
              label="remnants"
              on={laws.showRemnants}
              onChange={(showRemnants) => patchLaws({ showRemnants })}
            />
            <button
              type="button"
              className="csc-link mb-3 disabled:opacity-40"
              disabled={
                !fieldFold.organisms.some((organism) => organism.id === selectedId) ||
                field.some((step) => step.type === "compost" && step.organismId === selectedId)
              }
              onClick={returnSelected}
            >
              Return {selectedId} to the ground
            </button>
            <label className="mb-3 block text-white/60">
              <span className="flex justify-between">
                <span>moment</span>
                <span>
                  {moment ?? field.length} / {field.length}
                </span>
              </span>
              <input
                className="w-full"
                type="range"
                min={0}
                max={field.length}
                step={1}
                value={moment ?? field.length}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setMoment(value >= field.length ? null : value);
                }}
              />
            </label>
            <ol className="space-y-1">
              {field.map((entry, index) => {
                const ahead = moment != null && index >= moment;
                const organismId = entry.type === "contribution.planted" ? entry.id : entry.type === "compost" ? entry.organismId : "";
                const organism =
                  fieldFold.organisms.find((item) => item.id === organismId) ??
                  fieldFold.remnants.find((item) => item.id === organismId);
                const active = organismId !== "" && organismId === selected?.id;
                return (
                  <li key={entry.id} className="flex items-center gap-2" style={{ opacity: ahead ? 0.35 : 1 }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (organismId) setSelectedId(organismId);
                      }}
                      className="flex-1 text-left"
                      style={{ color: active ? "#cfff81" : "rgba(255,255,255,0.7)" }}
                    >
                      {index + 1}.{" "}
                      {entry.type === "compost" ? `return ${entry.organismId}` : entry.type === "tick" ? "time" : entry.id}
                      {entry.type === "compost"
                        ? ` · density ${entry.returns.density.toFixed(3)}`
                        : entry.type === "tick"
                          ? ""
                          : organism
                            ? ` · tension ${organism.birthConditions.tension.toFixed(3)}`
                            : ""}
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
                setTimePassing(false);
                setField(plantedSteps(FIELD_SEED));
                setMoment(null);
                setGrowEpoch((n) => n + 1);
              }}
            >
              Reset log
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
