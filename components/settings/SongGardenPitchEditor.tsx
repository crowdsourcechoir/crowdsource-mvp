"use client";

import { useEffect, useState } from "react";
import type { CopyBlock, PitchSlide } from "@/app/sobeca-song-garden/content";

function slideLabel(slide: PitchSlide): string {
  const titled = slide.blocks.find((block) => block.type === "title" || block.type === "heading");
  return titled && "text" in titled ? titled.text : slide.id;
}

function updateBlock(slide: PitchSlide, index: number, block: CopyBlock): PitchSlide {
  const blocks = slide.blocks.slice();
  blocks[index] = block;
  return { ...slide, blocks };
}

export default function SongGardenPitchEditor() {
  const [slides, setSlides] = useState<PitchSlide[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/sobeca-song-garden/copy", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load copy");
        setSlides(data.slides);
      })
      .catch((err) => setStatus(err instanceof Error ? err.message : "Could not load copy"));
  }, []);

  async function save(next: PitchSlide[] | null) {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/sobeca-song-garden/copy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next ? { slides: next } : { reset: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSlides(data.slides);
      setStatus(next ? "Saved. The public page is using this copy." : "Reset to the copy in the site file.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!slides) {
    return <p className="text-sm text-white/70">{status ?? "Loading copy…"}</p>;
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-full border border-[var(--csc-accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--csc-accent)] hover:bg-[var(--csc-accent)] hover:text-black disabled:opacity-50"
          disabled={saving}
          onClick={() => save(slides)}
        >
          Save
        </button>
        <button type="button" className="csc-link text-sm" disabled={saving} onClick={() => save(null)}>
          Reset to file
        </button>
        <a className="csc-link text-sm" href="/sobeca-song-garden" target="_blank" rel="noreferrer">
          View page
        </a>
        {status ? <p className="text-sm text-white/70">{status}</p> : null}
      </div>
      {slides.map((slide, slideIndex) => (
        <section key={slide.id} className="space-y-4">
          <h2 className="csc-eyebrow">{slideLabel(slide)}</h2>
          {slide.blocks.map((block, blockIndex) => {
            if (block.type === "image") return null;
            if (block.type === "list") {
              return (
                <label key={blockIndex} className="block text-sm">
                  List
                  {block.items.map((item, itemIndex) => (
                    <textarea
                      key={itemIndex}
                      className="mt-2 w-full border border-white/15 bg-black px-3 py-2 text-white"
                      rows={2}
                      value={item}
                      onChange={(event) => {
                        const items = block.items.slice();
                        items[itemIndex] = event.target.value;
                        const next = slides.slice();
                        next[slideIndex] = updateBlock(slide, blockIndex, { ...block, items });
                        setSlides(next);
                      }}
                    />
                  ))}
                </label>
              );
            }
            if (block.type === "table") {
              return (
                <div key={blockIndex} className="space-y-2">
                  {block.rows.map((row, rowIndex) => (
                    <div key={rowIndex} className="grid gap-2 sm:grid-cols-2">
                      {row.map((cell, cellIndex) => (
                        <textarea
                          key={cellIndex}
                          className="w-full border border-white/15 bg-black px-3 py-2 text-sm text-white"
                          rows={3}
                          value={cell}
                          aria-label={block.headers[cellIndex] ?? "Cell"}
                          onChange={(event) => {
                            const rows = block.rows.map((current) => current.slice());
                            rows[rowIndex][cellIndex] = event.target.value;
                            const next = slides.slice();
                            next[slideIndex] = updateBlock(slide, blockIndex, { ...block, rows });
                            setSlides(next);
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <label key={blockIndex} className="block text-sm text-white/70">
                {block.type}
                <textarea
                  className="mt-2 w-full border border-white/15 bg-black px-3 py-2 text-white"
                  rows={block.type === "paragraph" ? 5 : 2}
                  value={block.text}
                  onChange={(event) => {
                    const next = slides.slice();
                    next[slideIndex] = updateBlock(slide, blockIndex, { ...block, text: event.target.value });
                    setSlides(next);
                  }}
                />
              </label>
            );
          })}
        </section>
      ))}
    </div>
  );
}
