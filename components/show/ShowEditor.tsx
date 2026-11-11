"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ShowStage from "@/components/show/ShowStage";
import { FieldLabel, SettingsButton, SettingsSelect, TextField } from "@/components/settings/ui";
import {
  blankSlide,
  LYRIC_FONTS,
  LYRIC_SIZE_MAX,
  LYRIC_SIZE_MIN,
  nextLyricCue,
  pickLoop,
  revealedLines,
  SIZE_PRESETS,
  spokenLines,
  type LyricCue,
  type LyricFontId,
  type ShowDeck,
  type ShowLoop,
  type ShowSlide,
} from "@/lib/show-slides/model";

type Option = { id: string; title: string; slug?: string };

type Background = {
  bloom: { id: string; slug: string; title: string } | null;
  garden: { id: string; title: string } | null;
  primaryColor: string;
  accentColor: string;
  loops: ShowLoop[];
  source: "bloom" | "garden" | "none";
};

const EMPTY_BACKGROUND: Background = {
  bloom: null,
  garden: null,
  primaryColor: "#1a0f2d",
  accentColor: "#CFFF81",
  loops: [],
  source: "none",
};

function draftKey(id: string): string {
  return `csc-show-draft:${id}`;
}

function remember(show: ShowDeck) {
  try {
    localStorage.setItem(draftKey(show.id), JSON.stringify(show));
  } catch {
    /* private mode */
  }
}

export default function ShowEditor({ showId }: { showId: string }) {
  const [show, setShow] = useState<ShowDeck | null>(null);
  const [gardens, setGardens] = useState<Option[]>([]);
  const [blooms, setBlooms] = useState<Option[]>([]);
  const [background, setBackground] = useState<Background>(EMPTY_BACKGROUND);
  const [selected, setSelected] = useState(0);
  const [cue, setCue] = useState<LyricCue>({ slide: 0, revealed: 0 });
  const [mode, setMode] = useState<"trigger" | "full">("trigger");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/shows/${encodeURIComponent(showId)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not open the show");
        if (!cancelled) setShow(data.show);
      })
      .catch((err: unknown) => {
        if (!cancelled) setStatus(err instanceof Error ? err.message : "Could not open the show");
      });
    fetch("/api/gardens", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        const rows = Array.isArray(data.gardens) ? data.gardens : [];
        if (!cancelled) setGardens(rows.map((row: Option) => ({ id: row.id, title: row.title, slug: row.slug })));
      })
      .catch(() => undefined);
    fetch("/api/events", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => []);
        const rows = Array.isArray(data) ? data : [];
        if (!cancelled) setBlooms(rows.map((row: Option) => ({ id: row.id, title: row.title, slug: row.slug })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [showId]);

  const loadBackground = useCallback(async (current: ShowDeck) => {
    const params = new URLSearchParams();
    params.set("gardenId", current.gardenId ?? "");
    params.set("bloomId", current.bloomId ?? "");
    const res = await fetch(`/api/shows/${encodeURIComponent(current.id)}/background?${params}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.background) setBackground(data.background as Background);
  }, []);

  const showRef = useRef(show);
  showRef.current = show;

  useEffect(() => {
    const current = showRef.current;
    if (!current) return;
    void loadBackground(current);
  }, [show?.id, show?.gardenId, show?.bloomId, loadBackground]);

  const slideIndex = show ? Math.max(0, Math.min(show.slides.length - 1, selected)) : 0;
  const slide = show?.slides[slideIndex];
  const previewSlide = mode === "trigger" && show ? show.slides[Math.min(cue.slide, show.slides.length - 1)] : slide;
  const previewLines = useMemo(() => {
    if (!previewSlide) return [];
    if (mode === "full") return spokenLines(previewSlide.lines);
    return revealedLines(previewSlide, cue.slide === slideIndex || mode === "trigger" ? cue.revealed : 0);
  }, [previewSlide, mode, cue, slideIndex]);

  function update(next: ShowDeck) {
    const touched = { ...next, updatedAt: new Date().toISOString() };
    setShow(touched);
    remember(touched);
    setStatus(null);
  }

  function updateSlide(index: number, patch: Partial<ShowSlide>) {
    if (!show) return;
    const slides = show.slides.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
    update({ ...show, slides });
  }

  async function save(current: ShowDeck): Promise<boolean> {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/shows/${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: current.name,
          gardenId: current.gardenId,
          bloomId: current.bloomId,
          slides: current.slides,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setShow(data.show);
      remember(data.show);
      setStatus("Saved");
      return true;
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!show || show.builtin) return;
    if (!window.confirm(`Delete “${show.name}”?`)) return;
    const res = await fetch(`/api/shows/${encodeURIComponent(show.id)}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error ?? "Could not delete");
      return;
    }
    window.location.href = "/admin/shows";
  }

  if (!show || !slide || !previewSlide) {
    return <p className="text-sm text-gray-400">{status ?? "Loading the show"}</p>;
  }

  const fontNote = LYRIC_FONTS.find((font) => font.id === slide.font)?.note;
  const loop = pickLoop(background.loops, previewSlide.loopIndex);
  const videoNote = background.bloom
    ? `Video loops from ${background.bloom.title}.`
    : background.source === "garden" && background.garden
      ? `Video loops from the ${background.garden.title} garden.`
      : show.match
        ? "No Gather bloom is connected in this workspace yet. Assign the conference bloom and its loops will fill the slide."
        : "Assign a bloom to use its video loops.";

  return (
    <div className="text-white">
      <Link href="/admin/shows" className="csc-link text-sm">
        ← Shows
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="csc-eyebrow">1920 × 1080</p>
          <div className="mt-2 max-w-md">
            <TextField value={show.name} onChange={(name) => update({ ...show, name })} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SettingsButton variant="primary" disabled={saving} onClick={() => void save(show)}>
            {saving ? "Saving" : "Save"}
          </SettingsButton>
          <SettingsButton
            disabled={saving}
            onClick={() => {
              remember(show);
              void save(show).finally(() => {
                window.location.href = `/show/${show.slug}`;
              });
            }}
          >
            Present
          </SettingsButton>
          {show.builtin ? null : (
            <SettingsButton variant="danger" onClick={() => void remove()}>
              Delete
            </SettingsButton>
          )}
        </div>
      </div>
      {status ? <p className="mt-3 text-sm text-gray-400">{status}</p> : null}

      <div className="mt-6 grid items-start gap-8 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border border-[var(--csc-row-divider)] p-4">
            <div>
              <FieldLabel hint="The show can belong to a garden, a bloom, or both. Video comes from the bloom.">
                Song Garden
              </FieldLabel>
              <SettingsSelect
                ariaLabel="Song Garden"
                value={show.gardenId ?? ""}
                onChange={(gardenId) => update({ ...show, gardenId: gardenId || null })}
              >
                <option value="">None</option>
                {gardens.map((garden) => (
                  <option key={garden.id} value={garden.id}>
                    {garden.title}
                  </option>
                ))}
              </SettingsSelect>
            </div>
            <div>
              <FieldLabel hint={videoNote}>Bloom</FieldLabel>
              <SettingsSelect
                ariaLabel="Bloom"
                value={show.bloomId || background.bloom?.id || ""}
                onChange={(bloomId) => update({ ...show, bloomId: bloomId || null })}
              >
                <option value="">{show.match ? "Match a bloom named Gather" : "None"}</option>
                {blooms.map((bloom) => (
                  <option key={bloom.id} value={bloom.id}>
                    {bloom.title}
                  </option>
                ))}
                {background.bloom && !blooms.some((bloom) => bloom.id === background.bloom?.id) ? (
                  <option value={background.bloom.id}>{background.bloom.title}</option>
                ) : null}
              </SettingsSelect>
              {background.bloom ? (
                <Link href={`/admin/events/${background.bloom.id}`} className="csc-link mt-2 inline-flex text-xs">
                  Open {background.bloom.title}
                </Link>
              ) : null}
            </div>
            {background.loops.length > 0 ? (
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <FieldLabel hint="These are the bloom's background plates, in the order the bloom shows them. Stored generations stay available.">
                    Background videos
                  </FieldLabel>
                  <SettingsButton
                    onClick={() => {
                      const slides = show.slides.map((item, index) => ({
                        ...item,
                        loopIndex: index % background.loops.length,
                      }));
                      update({ ...show, slides });
                    }}
                  >
                    Use in order
                  </SettingsButton>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {background.loops.map((item, index) => {
                    const selected = Math.min(slide.loopIndex, background.loops.length - 1) === index;
                    return (
                      <button
                        key={`${item.label}-${item.videoUrl ?? item.sceneUrl}-${index}`}
                        type="button"
                        aria-pressed={selected}
                        aria-label={`Use ${item.label}`}
                        onClick={() => updateSlide(slideIndex, { loopIndex: index })}
                        className={`relative h-20 w-36 shrink-0 overflow-hidden rounded-lg border ${
                          selected ? "border-[var(--csc-accent)]" : "border-white/15"
                        }`}
                      >
                        {item.videoUrl ? (
                          <video
                            className="h-full w-full object-cover"
                            src={item.videoUrl}
                            poster={item.sceneUrl ?? undefined}
                            muted
                            loop
                            autoPlay
                            playsInline
                          />
                        ) : item.sceneUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt="" src={item.sceneUrl} className="h-full w-full object-cover" />
                        ) : null}
                        <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="csc-eyebrow">Slides</p>
              <button
                type="button"
                className="csc-btn-circle text-sm"
                aria-label="Add slide"
                onClick={() => {
                  const slides = [...show.slides, blankSlide(`slide_${Date.now().toString(36)}`)];
                  update({ ...show, slides });
                  setSelected(slides.length - 1);
                }}
              >
                +
              </button>
            </div>
            <div className="csc-list">
              {show.slides.map((item, index) => (
                <div key={item.id} className="csc-list-row">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setSelected(index);
                      setCue({ slide: index, revealed: 0 });
                    }}
                  >
                    <span className="block text-sm text-white">
                      {spokenLines(item.lines)[0] || `Slide ${index + 1}`}
                    </span>
                    <span className="mt-1 block text-xs text-gray-500">
                      {LYRIC_FONTS.find((font) => font.id === item.font)?.label} · {item.sizePx}px
                    </span>
                  </button>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      className="csc-btn-circle text-xs"
                      aria-label="Move slide up"
                      disabled={index === 0}
                      onClick={() => {
                        if (index === 0) return;
                        const slides = show.slides.slice();
                        const [moved] = slides.splice(index, 1);
                        slides.splice(index - 1, 0, moved);
                        update({ ...show, slides });
                        setSelected(index - 1);
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="csc-btn-circle text-xs"
                      aria-label="Delete slide"
                      disabled={show.slides.length <= 1}
                      onClick={() => {
                        if (show.slides.length <= 1) return;
                        update({ ...show, slides: show.slides.filter((candidate) => candidate.id !== item.id) });
                        setSelected(Math.max(0, index - 1));
                      }}
                    >
                      ×
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <FieldLabel hint="One lyric line per row. A click on the slide reveals the next row.">Lines</FieldLabel>
              <textarea
                aria-label="Lyric lines"
                value={slide.lines.join("\n")}
                onChange={(event) => updateSlide(slideIndex, { lines: event.target.value.split("\n").slice(0, 24) })}
                rows={6}
                className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[var(--csc-accent)] focus:outline-none"
                placeholder="Type a lyric line"
              />
            </div>
            <div>
              <FieldLabel hint={fontNote}>Font</FieldLabel>
              <SettingsSelect
                ariaLabel="Lyric font"
                value={slide.font}
                onChange={(font) => updateSlide(slideIndex, { font: font as LyricFontId })}
              >
                {LYRIC_FONTS.map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.label}
                  </option>
                ))}
              </SettingsSelect>
            </div>
            <div>
              <FieldLabel hint="Huge for a single line. Tight when the verse needs more room. The slide shrinks type that does not fit.">
                Size {slide.sizePx}px
              </FieldLabel>
              <input
                aria-label="Lyric size"
                type="range"
                min={LYRIC_SIZE_MIN}
                max={LYRIC_SIZE_MAX}
                value={slide.sizePx}
                onChange={(event) => updateSlide(slideIndex, { sizePx: Number(event.target.value) })}
                className="w-full accent-[var(--csc-accent)]"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {SIZE_PRESETS.map((preset) => (
                  <SettingsButton
                    key={preset.id}
                    variant={slide.sizePx === preset.px ? "primary" : "ghost"}
                    onClick={() => updateSlide(slideIndex, { sizePx: preset.px })}
                  >
                    {preset.label}
                  </SettingsButton>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="csc-eyebrow">Slide</p>
            <div className="flex gap-2">
              <SettingsButton variant={mode === "trigger" ? "primary" : "ghost"} onClick={() => {
                setMode("trigger");
                setCue({ slide: slideIndex, revealed: 0 });
              }}>
                Trigger
              </SettingsButton>
              <SettingsButton variant={mode === "full" ? "primary" : "ghost"} onClick={() => setMode("full")}>
                Full slide
              </SettingsButton>
            </div>
          </div>
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[var(--csc-row-divider)]">
            <div className="absolute inset-0">
            <ShowStage
              lines={previewLines}
              font={previewSlide.font}
              sizePx={previewSlide.sizePx}
              loop={loop}
              primaryColor={background.primaryColor}
              accentColor={background.accentColor}
              interactive={mode === "trigger"}
              hint={mode === "trigger" && previewLines.length === 0 ? "Click to trigger the line" : null}
              onAdvance={(direction) => setCue((current) => nextLyricCue(current, show.slides, direction))}
            />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            The frame is 1920×1080 and scales to this window. Space and the arrow keys trigger lines on the present screen.
          </p>
        </div>
      </div>
    </div>
  );
}
