"use client";

import { useState } from "react";
import LivingField from "@/components/song-garden-v2/LivingField";

type Kind = "Voice" | "Line" | "Hit";

type Contribution = {
  id: string;
  kind: Kind;
  label: string;
};

const STARTER: Contribution[] = [
  { id: "s1", kind: "Voice", label: "Harbor whistle" },
  { id: "s2", kind: "Line", label: "We came for the tide" },
  { id: "s3", kind: "Hit", label: "Dock stomp" },
  { id: "s4", kind: "Voice", label: "Low hum under the pier" },
  { id: "s5", kind: "Line", label: "Lights on the water" },
  { id: "s6", kind: "Hit", label: "Two claps, then one" },
  { id: "s7", kind: "Voice", label: "Name sung once" },
  { id: "s8", kind: "Line", label: "Stay until the last boat" },
];

const NEXT_LABEL: Record<Kind, string[]> = {
  Voice: ["A breath before the chorus", "Someone humming the hook", "A call from the back row"],
  Line: ["Hold the last word", "Say it with the room", "Leave a silence after"],
  Hit: ["Heel on the floor", "A snap on two", "Hands once, together"],
};

function energyFor(count: number): number {
  return Math.max(0.08, Math.min(1, count / 18));
}

/**
 * Standalone world for trying the point field.
 * It does not read or write a Garden or a Bloom.
 */
export default function FieldLabClient() {
  const [items, setItems] = useState<Contribution[]>(STARTER);
  const [liveMoment, setLiveMoment] = useState(false);
  const energy = energyFor(items.length);

  function add(kind: Kind) {
    const options = NEXT_LABEL[kind];
    const label = options[items.length % options.length];
    setItems((current) => [...current, { id: `n${current.length}`, kind, label }]);
    setLiveMoment(false);
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-black text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 70% 18%, rgba(207,255,129,0.16), transparent 55%), radial-gradient(80% 60% at 12% 88%, rgba(207,255,129,0.08), transparent 60%), #000",
        }}
        aria-hidden
      />
      <LivingField energy={energy} quiet={liveMoment} />

      <div className="relative z-10 flex min-h-[100dvh] flex-col justify-between px-5 py-6 sm:px-8">
        <header className="max-w-xl">
          <p className="csc-eyebrow">Test world</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Harbor Test</h1>
          <p className="mt-3 max-w-md text-sm text-gray-300">
            Eight contributions are already in the field. Move the pointer through them. Add more, or rest the field
            for a live moment. This page does not touch a live Garden or Bloom.
          </p>
        </header>

        <section className="mt-10 w-full max-w-xl border border-white/15 bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--csc-accent)]">
              {items.length} contributions · field {Math.round(energy * 100)}%
              {liveMoment ? " · resting" : ""}
            </p>
            <button
              type="button"
              onClick={() => setLiveMoment((on) => !on)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                liveMoment
                  ? "border-[var(--csc-accent)] bg-[var(--csc-accent)] text-black"
                  : "border-white/25 text-gray-200"
              }`}
            >
              {liveMoment ? "Leave the moment" : "Live moment"}
            </button>
          </div>
          <ul className="csc-list mt-3 max-h-40 overflow-y-auto">
            {items.map((item) => (
              <li key={item.id} className="csc-list-row py-2">
                <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--csc-accent)]">{item.kind}</span>
                <span className="text-sm text-white">{item.label}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => add("Voice")} className="rounded-full border border-[var(--csc-accent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--csc-accent)]">
              Add a voice
            </button>
            <button type="button" onClick={() => add("Line")} className="rounded-full border border-[var(--csc-accent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--csc-accent)]">
              Add a line
            </button>
            <button type="button" onClick={() => add("Hit")} className="rounded-full border border-[var(--csc-accent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--csc-accent)]">
              Add a hit
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
