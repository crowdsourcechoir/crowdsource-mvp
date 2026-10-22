"use client";

import { useState } from "react";
import {
  LANGUAGE_AXES,
  LANGUAGE_GATE,
  axisUsed,
  type LanguageReading,
} from "@/lib/song-garden-lab/language";

export default function WordsPanel() {
  const [text, setText] = useState("");
  const [reading, setReading] = useState<LanguageReading | null>(null);
  const [busy, setBusy] = useState(false);

  async function readWords() {
    setBusy(true);
    try {
      const response = await fetch("/api/lab/language", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const payload = (await response.json()) as LanguageReading;
      setReading(payload);
    } catch {
      setReading(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-4 border-t border-white/10 pt-3">
      <h2 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">Words</h2>
      <p className="mb-2 leading-relaxed text-white/45">
        A phrase can be held as three numbers, each with a confidence. Under {LANGUAGE_GATE.toFixed(2)} it is ignored. The ribbon still comes from the measurement.
      </p>
      <textarea
        className="mb-2 w-full resize-none bg-black px-2 py-1 text-white outline-none"
        rows={2}
        maxLength={240}
        value={text}
        placeholder="A few words"
        onChange={(event) => setText(event.target.value)}
      />
      <button type="button" className="csc-link mb-2" disabled={busy || text.trim().length < 2} onClick={() => void readWords()}>
        {busy ? "Reading words…" : "Read words"}
      </button>
      {reading && (
        <div data-language-available={reading.available ? "yes" : "no"} data-language-used={reading.available ? "model" : "unused"}>
          <p className="mb-1 text-white/60">
            {reading.available
              ? "A model answered. Only a number at or above the gate is kept."
              : "The words are kept. No model answered, so none of them enter the garden."}
          </p>
          {LANGUAGE_AXES.map((axis) => (
            <p key={axis} className="text-white/50">
              {axis} {reading[axis].value.toFixed(2)} · confidence {reading[axis].confidence.toFixed(2)} ·{" "}
              {axisUsed(reading[axis]) ? "kept" : "ignored"}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
