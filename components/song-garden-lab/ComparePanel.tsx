"use client";

import { useEffect, useState } from "react";
import {
  COUPLING_SWEEP,
  SHORT_B_ORDER,
  WORLD_B_ORDER,
  closerThanStranger,
  subjectRow,
  type CompareReport,
} from "@/lib/song-garden-lab/compare";
import type { Conditions, Laws } from "@/lib/song-garden-lab/types";

const NOTES_KEY = "song-garden-lab-compare-notes";

export type CompareView = "both" | "a" | "b" | "pair";
export type CompareSpan = "twelve" | "four";

export default function ComparePanel({
  report,
  view,
  span,
  laws,
  onView,
  onSpan,
  onSweep,
  onBoundary,
  onHear,
  onLaws,
}: {
  report: CompareReport;
  view: CompareView;
  span: CompareSpan;
  laws: Laws;
  onView: (view: CompareView) => void;
  onSpan: (span: CompareSpan) => void;
  onSweep: (coupling: number) => void;
  onBoundary: () => void;
  onHear: (which: "all" | "density" | "tension") => void;
  onLaws: (patch: Partial<Laws>) => void;
}) {
  const [notes, setNotes] = useState("");
  const subject = subjectRow(report);
  const order = span === "twelve" ? WORLD_B_ORDER : SHORT_B_ORDER;

  useEffect(() => {
    const saved = localStorage.getItem(NOTES_KEY);
    if (saved) setNotes(saved);
  }, []);

  return (
    <section className="mb-4 border-t border-white/10 pt-3">
      <h2 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">World A / World B</h2>
      <p className="mb-2 leading-relaxed text-white/70">Are these the same community?</p>
      <p className="mb-3 leading-relaxed text-white/70">
        Find {report.subjectId} in the other world. It is plant {subject ? subject.placeA : "—"} in A and plant{" "}
        {subject ? subject.placeB : "—"} in B.
      </p>
      <p className="mb-3 leading-relaxed text-white/45">
        Keys 1–5 step the official sweep. A, B, and 0 switch the view. P isolates the selected body. L hides labels. Hide
        the names before you try to find it.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            ["both", "Both"],
            ["a", "A"],
            ["b", "B"],
            ["pair", "This one"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onView(id)}
            className="rounded-full border px-3 py-1"
            style={{
              borderColor: view === id ? "#cfff81" : "rgba(255,255,255,0.2)",
              color: view === id ? "#111" : "#cfff81",
              background: view === id ? "#cfff81" : "transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-3">
        <button type="button" className="csc-link" onClick={() => onSpan("twelve")} style={{ color: span === "twelve" ? "#cfff81" : undefined }}>
          Twelve
        </button>
        <button type="button" className="csc-link" onClick={() => onSpan("four")} style={{ color: span === "four" ? "#cfff81" : undefined }}>
          Four
        </button>
      </div>

      <p className="mb-2 text-white/45">World B · {order.join(" · ")}</p>
      <div className="mb-3 flex flex-wrap gap-3">
        {COUPLING_SWEEP.map((value, index) => (
          <button
            key={value}
            type="button"
            className="csc-link"
            onClick={() => onSweep(value)}
            style={{ color: !laws.branchFromTension && Math.abs(laws.coupling - value) < 0.001 ? "#cfff81" : undefined }}
          >
            {index + 1} · {value.toFixed(2)}
          </button>
        ))}
      </div>
      <button type="button" className="csc-link mb-3" onClick={onBoundary} style={{ color: laws.branchFromTension ? "#cfff81" : undefined }}>
        Boundary · arms at 0.50
      </button>
      {laws.branchFromTension && (
        <p className="mb-3 text-white/60">
          {report.armMismatches === 0
            ? "The arm law did not change a topology on this set."
            : `${report.armMismatches} ${report.armMismatches === 1 ? "body grew" : "bodies grew"} an arm in only one world.`}
        </p>
      )}

      <div className="mb-3 flex flex-wrap gap-3">
        <button type="button" className="csc-link" onClick={() => onHear("all")}>
          All conditions
        </button>
        <button type="button" className="csc-link" onClick={() => onHear("density")}>
          Density only
        </button>
        <button type="button" className="csc-link" onClick={() => onHear("tension")}>
          Tension only
        </button>
      </div>

      {subject && (
        <div className="mb-3">
          <h2 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">{subject.id}</h2>
          <p className="text-white/70">
            bend {subject.bendA.toFixed(2)} in A · {subject.bendB.toFixed(2)} in B
          </p>
          <p className="text-white/50">
            birth tension {subject.birthA.tension.toFixed(3)} in A · {subject.birthB.tension.toFixed(3)} in B
          </p>
          <p className="text-white/50">
            channel distance {subject.cross.toFixed(3)} · a typical pair in A is {report.medianWithinA.toFixed(3)}
          </p>
          <p className="text-[#cfff81]">
            {closerThanStranger(report, subject.id)
              ? "Closer than a stranger in World A. That is a measurement, not the verdict."
              : "Farther apart than a typical pair in World A. That is a measurement, not the verdict."}
          </p>
        </div>
      )}

      <h2 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">Conditions</h2>
      <ConditionLine label="A" conditions={report.finalA} />
      <ConditionLine label="B" conditions={report.finalB} />
      <p className="mb-3 text-white/45">
        {report.finalsDiffer ? "The finals differ. Tension carries the path." : "The finals match on this draft."}
        {laws.coupling < 0.001
          ? ` Ground shift ${report.maxPlacement.toFixed(3)}. Shapes match.`
          : ` Ground shift ${report.maxPlacement.toFixed(3)}.`}
      </p>
      <Trajectory a={report.trajectoryA} b={report.trajectoryB} />

      <h2 className="mb-2 mt-3 text-[10px] uppercase tracking-[0.2em] text-white/50">Distances</h2>
      <p className="mb-2 text-white/45">
        Median cross {report.medianCross.toFixed(3)} · median pair in A {report.medianWithinA.toFixed(3)}
      </p>
      <table className="mb-3 w-full text-left text-white/70">
        <thead className="text-white/40">
          <tr>
            <th className="py-1 font-normal">Id</th>
            <th className="py-1 font-normal">Cross</th>
            <th className="py-1 font-normal">Arm</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.id} style={{ color: row.id === report.subjectId ? "#cfff81" : undefined }}>
              <td className="py-0.5">
                {row.id} · {row.placeA}/{row.placeB}
              </td>
              <td>{row.cross.toFixed(3)}</td>
              <td>{row.armA === row.armB ? (row.armA ? "arm" : "—") : "split"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <label className="mb-2 block text-white/50">
        resistance
        <input
          className="w-full"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={laws.resistanceStrength}
          onChange={(event) => onLaws({ resistanceStrength: Number(event.target.value) })}
        />
      </label>
      <label className="mb-3 block text-white/50">
        leak {laws.leak.density.toFixed(2)}
        <input
          className="w-full"
          type="range"
          min={0}
          max={0.2}
          step={0.01}
          value={laws.leak.density}
          onChange={(event) => {
            const leak = Number(event.target.value);
            onLaws({ leak: { density: leak, pulse: leak, tension: leak } });
          }}
        />
      </label>

      <h2 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">Notes</h2>
      <textarea
        className="mb-2 h-24 w-full border border-white/20 bg-black p-2 text-white"
        value={notes}
        placeholder="Same community? Could you find it?"
        onChange={(event) => {
          setNotes(event.target.value);
          try {
            localStorage.setItem(NOTES_KEY, event.target.value);
          } catch {
            /* notes stay on screen */
          }
        }}
      />
    </section>
  );
}

function ConditionLine({ label, conditions }: { label: string; conditions: Conditions }) {
  return (
    <p className="text-white/60">
      {label} density {conditions.density.toFixed(3)} · pulse {conditions.pulse.toFixed(3)} · tension{" "}
      {conditions.tension.toFixed(3)}
    </p>
  );
}

function Trajectory({ a, b }: { a: Conditions[]; b: Conditions[] }) {
  const keys = ["density", "pulse", "tension"] as const;
  return (
    <div className="space-y-2">
      {keys.map((key) => (
        <div key={key}>
          <p className="text-white/40">{key}</p>
          <svg viewBox="0 0 300 36" className="h-9 w-full">
            <polyline fill="none" stroke="#cfff81" strokeWidth="1.4" points={linePoints(a, key)} />
            <polyline
              fill="none"
              stroke="#cfff81"
              strokeWidth="1.2"
              strokeDasharray="3 3"
              opacity={0.7}
              points={linePoints(b, key)}
            />
          </svg>
        </div>
      ))}
      <p className="text-white/40">Solid is A. Dashed is B.</p>
    </div>
  );
}

function linePoints(series: Conditions[], key: keyof Conditions): string {
  const width = 300;
  const height = 36;
  const pad = 3;
  const last = Math.max(1, series.length - 1);
  return series
    .map((conditions, index) => {
      const x = pad + (index / last) * (width - pad * 2);
      const y = height - pad - conditions[key] * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
