"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ShowStage from "@/components/show/ShowStage";
import { SettingsButton, SettingsSelect, TextField } from "@/components/settings/ui";
import {
  blankSlide,
  LYRIC_FONTS,
  LOGO_WIDTH_DEFAULT,
  LOGO_WIDTH_MAX,
  LOGO_WIDTH_MIN,
  LYRIC_SIZE_MAX,
  LYRIC_SIZE_MIN,
  nextLyricCue,
  pickLoop,
  revealedLines,
  SIZE_PRESETS,
  SHOW_OVERLAY_AMOUNT,
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
  const [bloomPlates, setBloomPlates] = useState<Record<string, Background>>({});
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
  const listRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const current = showRef.current;
    if (!current) return;
    void loadBackground(current);
  }, [show?.id, show?.gardenId, show?.bloomId, loadBackground]);

  const slideBloomKey = show?.slides.map((item) => item.bloomId ?? "").join("|") ?? "";
  useEffect(() => {
    const current = showRef.current;
    if (!current) return;
    const ids = Array.from(new Set(current.slides.map((item) => item.bloomId).filter((id): id is string => Boolean(id))));
    let cancelled = false;
    for (const bloomId of ids) {
      const params = new URLSearchParams();
      params.set("gardenId", current.gardenId ?? "");
      params.set("bloomId", bloomId);
      void fetch(`/api/shows/${encodeURIComponent(current.id)}/background?${params}`, { cache: "no-store" })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!cancelled && res.ok && data.background) {
            setBloomPlates((prev) => ({ ...prev, [bloomId]: data.background as Background }));
          }
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [show?.id, show?.gardenId, slideBloomKey]);

  const slideIndex = show ? Math.max(0, Math.min(show.slides.length - 1, selected)) : 0;
  const slide = show?.slides[slideIndex];
  const previewSlide = mode === "trigger" && show ? show.slides[Math.min(cue.slide, show.slides.length - 1)] : slide;
  const previewLines = useMemo(() => {
    if (!previewSlide) return [];
    if (mode === "full") return spokenLines(previewSlide.lines);
    return revealedLines(previewSlide, cue.slide === slideIndex || mode === "trigger" ? cue.revealed : 0);
  }, [previewSlide, mode, cue, slideIndex]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const row = list.querySelector<HTMLElement>(`[data-slide-index="${slideIndex}"]`);
    if (!row) return;
    const listRect = list.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    if (rowRect.top < listRect.top) list.scrollTop -= listRect.top - rowRect.top;
    else if (rowRect.bottom > listRect.bottom) list.scrollTop += rowRect.bottom - listRect.bottom;
  }, [slideIndex, show?.slides.length]);

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

  function moveSlide(index: number, direction: -1 | 1) {
    if (!show) return;
    const target = index + direction;
    if (target < 0 || target >= show.slides.length) return;
    const slides = show.slides.slice();
    const [moved] = slides.splice(index, 1);
    if (!moved) return;
    slides.splice(target, 0, moved);
    update({ ...show, slides });
    setSelected(target);
    setCue((current) => (current.slide === index ? { ...current, slide: target } : current));
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
    window.location.href = "/admin/live";
  }

  if (!show || !slide || !previewSlide) {
    return <p className="text-sm text-gray-400">{status ?? "Loading the show"}</p>;
  }

  const fontNote = LYRIC_FONTS.find((font) => font.id === slide.font)?.note;
  function platesFor(item: ShowSlide | undefined): Background {
    if (item?.bloomId) return bloomPlates[item.bloomId] ?? EMPTY_BACKGROUND;
    return background;
  }
  const stagePlates = platesFor(previewSlide);
  const slidePlates = platesFor(slide);
  const loop = pickLoop(stagePlates.loops, previewSlide.loopIndex);
  const slideBloomTitle = slide.bloomId
    ? blooms.find((bloom) => bloom.id === slide.bloomId)?.title || slidePlates.bloom?.title || "this bloom"
    : null;
  const plate =
    slidePlates.loops.length > 0
      ? slidePlates.loops[Math.min(slide.loopIndex, slidePlates.loops.length - 1)]
      : null;
  const videoSummary = [
    slideBloomTitle ?? slidePlates.bloom?.title ?? background.bloom?.title ?? (show.match ? "Gather bloom" : "No bloom"),
    plate?.label,
    slide.motion === "return" ? "forward and back" : null,
    slide.speed && slide.speed < 1 ? `${Math.round(slide.speed * 100)}% speed` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const videoNote =
    slidePlates.loops.length > 0
      ? null
      : slidePlates.bloom
        ? "This bloom has no video loops yet."
        : background.source === "garden" && background.garden
          ? `Loops come from the ${background.garden.title} garden.`
          : show.match
            ? "Gather's plates load from the live bloom."
            : "Assign a bloom to use its video loops.";

  return (
    <div className="flex flex-col text-white lg:h-[calc(100dvh-3rem)] lg:overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
        <Link href="/admin/live" className="csc-link shrink-0 text-sm">
          ← Live
        </Link>
        <label className="min-w-[10rem] flex-1 sm:max-w-xs">
          <span className="sr-only">Show name</span>
          <TextField value={show.name} onChange={(name) => update({ ...show, name })} />
        </label>
        <p className="csc-eyebrow hidden shrink-0 xl:block">1920 × 1080</p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SettingsButton
            variant={mode === "trigger" ? "primary" : "ghost"}
            onClick={() => {
              setMode("trigger");
              setCue({ slide: slideIndex, revealed: 0 });
            }}
          >
            Trigger
          </SettingsButton>
          <SettingsButton variant={mode === "full" ? "primary" : "ghost"} onClick={() => setMode("full")}>
            Full slide
          </SettingsButton>
          <span className="mx-1 hidden h-4 w-px bg-white/15 sm:block" aria-hidden />
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
      {status ? <p className="mt-2 shrink-0 text-xs text-gray-400">{status}</p> : null}

      <div className="mt-3 grid min-h-0 flex-1 gap-4 lg:grid-cols-[272px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
        <section className="order-2 flex min-h-0 flex-col overflow-hidden max-lg:max-h-72 lg:order-1 lg:h-full">
          <div className="mb-1 flex shrink-0 items-center gap-1">
            <p className="csc-eyebrow">Slides</p>
            <span className="text-[11px] tabular-nums text-gray-500">{show.slides.length}</span>
            <span className="ml-auto flex items-center gap-1">
              <button
                type="button"
                className="csc-btn-circle text-xs disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Move slide up"
                disabled={slideIndex === 0}
                onClick={() => moveSlide(slideIndex, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="csc-btn-circle text-xs disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Move slide down"
                disabled={slideIndex >= show.slides.length - 1}
                onClick={() => moveSlide(slideIndex, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="csc-btn-circle text-xs disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Delete slide"
                disabled={show.slides.length <= 1}
                onClick={() => {
                  if (show.slides.length <= 1) return;
                  const nextIndex = Math.max(0, slideIndex - 1);
                  update({ ...show, slides: show.slides.filter((candidate) => candidate.id !== slide.id) });
                  setSelected(nextIndex);
                  setCue({ slide: nextIndex, revealed: 0 });
                }}
              >
                ×
              </button>
              <button
                type="button"
                className="csc-btn-circle text-sm"
                aria-label="Add slide"
                onClick={() => {
                  const slides = [...show.slides, blankSlide(`slide_${Date.now().toString(36)}`)];
                  const index = slides.length - 1;
                  update({ ...show, slides });
                  setSelected(index);
                  setCue({ slide: index, revealed: 0 });
                  linesRef.current?.focus();
                }}
              >
                +
              </button>
            </span>
          </div>
          <div ref={listRef} className="csc-list min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {show.slides.map((item, index) => {
              const title = spokenLines(item.lines)[0] || `Slide ${index + 1}`;
              const bloomName = item.bloomId ? blooms.find((bloom) => bloom.id === item.bloomId)?.title : "";
              const meta = `${LYRIC_FONTS.find((font) => font.id === item.font)?.label ?? "Font"} · ${item.sizePx}px${
                bloomName ? ` · ${bloomName}` : ""
              }${item.showLogo === false ? " · logo hidden" : item.logoAnchor === "center" ? " · logo center" : ""}${
                item.treatment === "overlay" ? " · overlay" : ""
              }`;
              return (
                <div
                  key={item.id}
                  data-slide-index={index}
                  className="csc-list-row min-w-0"
                  style={{
                    paddingTop: 7,
                    paddingBottom: 7,
                    outlineColor: index === slideIndex ? "var(--csc-accent)" : undefined,
                  }}
                >
                  <button
                    type="button"
                    title={meta}
                    aria-current={index === slideIndex ? "true" : undefined}
                    className={`min-w-0 flex-1 truncate text-left text-sm ${
                      index === slideIndex ? "text-[var(--csc-accent)]" : "text-white"
                    }`}
                    onClick={() => {
                      setSelected(index);
                      setCue({ slide: index, revealed: 0 });
                    }}
                  >
                    {title}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="order-1 flex min-h-0 flex-col gap-3 lg:order-2 lg:h-full lg:overflow-y-auto">
          <div
            className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl border border-[var(--csc-row-divider)] max-h-[calc(100dvh-22rem)] min-h-[160px]"
            title="The frame is 1920×1080. Space and the arrow keys trigger lines on the present screen."
          >
            <div className="absolute inset-0">
              <ShowStage
                lines={previewLines}
                font={previewSlide.font}
                sizePx={previewSlide.sizePx}
                showLogo={previewSlide.showLogo}
                logoWidth={previewSlide.logoWidth}
                logoAnchor={previewSlide.logoAnchor}
                treatment={previewSlide.treatment === "overlay" ? "overlay" : "card"}
                overlayColor={previewSlide.overlayColor}
                overlayAmount={previewSlide.overlayAmount}
                loop={loop}
                motion={previewSlide.motion}
                speed={previewSlide.speed}
                primaryColor={stagePlates.primaryColor}
                accentColor={stagePlates.accentColor}
                interactive={mode === "trigger"}
                hint={mode === "trigger" && previewLines.length === 0 ? "Click to trigger the line" : null}
                onAdvance={(direction) => setCue((current) => nextLyricCue(current, show.slides, direction))}
              />
            </div>
          </div>

          <div className="shrink-0">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <p className="text-xs font-medium text-gray-300">Lines</p>
              <p className="truncate text-[11px] text-gray-500">One line per row. Space and arrows trigger on the present screen.</p>
            </div>
            <textarea
              ref={linesRef}
              aria-label="Lyric lines"
              value={slide.lines.join("\n")}
              onChange={(event) => updateSlide(slideIndex, { lines: event.target.value.split("\n").slice(0, 24) })}
              rows={4}
              className="w-full resize-none rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[var(--csc-accent)] focus:outline-none"
              placeholder="Type a lyric line"
            />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="w-44" title={fontNote}>
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
            <input
              aria-label="Lyric size"
              title="The slide shrinks type that does not fit."
              type="range"
              min={LYRIC_SIZE_MIN}
              max={LYRIC_SIZE_MAX}
              value={slide.sizePx}
              onChange={(event) => updateSlide(slideIndex, { sizePx: Number(event.target.value) })}
              className="w-28 accent-[var(--csc-accent)]"
            />
            <span className="w-12 text-xs tabular-nums text-gray-400">{slide.sizePx}px</span>
            {SIZE_PRESETS.map((preset) => (
              <SettingsButton
                key={preset.id}
                variant={slide.sizePx === preset.px ? "primary" : "ghost"}
                onClick={() => updateSlide(slideIndex, { sizePx: preset.px })}
              >
                {preset.label}
              </SettingsButton>
            ))}
            <SettingsButton
              title="Card keeps the glass panel. Overlay sets the words on the picture."
              variant={slide.treatment === "overlay" ? "ghost" : "primary"}
              onClick={() =>
                updateSlide(slideIndex, { treatment: undefined, overlayColor: undefined, overlayAmount: undefined })
              }
            >
              Card
            </SettingsButton>
            <SettingsButton
              title="Card keeps the glass panel. Overlay sets the words on the picture."
              variant={slide.treatment === "overlay" ? "primary" : "ghost"}
              onClick={() => updateSlide(slideIndex, { treatment: "overlay" })}
            >
              Overlay
            </SettingsButton>
            <SettingsButton
              title="Crowdsource Choir mark. Each slide chooses a size, the upper left or the center, and whether it shows."
              variant={slide.showLogo !== false ? "primary" : "ghost"}
              onClick={() => updateSlide(slideIndex, { showLogo: slide.showLogo === false })}
            >
              {slide.showLogo !== false ? "Logo on" : "Logo off"}
            </SettingsButton>
            <SettingsButton
              variant={slide.logoAnchor !== "center" ? "primary" : "ghost"}
              onClick={() => updateSlide(slideIndex, { logoAnchor: "left" })}
            >
              Upper left
            </SettingsButton>
            <SettingsButton
              variant={slide.logoAnchor === "center" ? "primary" : "ghost"}
              onClick={() => updateSlide(slideIndex, { logoAnchor: "center" })}
            >
              Center
            </SettingsButton>
            <input
              aria-label="Logo size"
              title="Width of the mark on the 1920×1080 frame."
              type="range"
              min={LOGO_WIDTH_MIN}
              max={LOGO_WIDTH_MAX}
              value={slide.logoWidth ?? LOGO_WIDTH_DEFAULT}
              onChange={(event) => updateSlide(slideIndex, { logoWidth: Number(event.target.value) })}
              className="w-24 accent-[var(--csc-accent)]"
            />
          </div>
          {slide.treatment === "overlay" ? (
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <span className="text-[11px] tabular-nums text-gray-400">
                Transparency {Math.round((1 - (slide.overlayAmount ?? SHOW_OVERLAY_AMOUNT)) * 100)}%
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                aria-label="Overlay transparency"
                title="0% is the full color. 100% shows the picture as it was shot."
                value={Math.round((1 - (slide.overlayAmount ?? SHOW_OVERLAY_AMOUNT)) * 100)}
                onChange={(event) => {
                  const transparency = Number(event.target.value) / 100;
                  updateSlide(slideIndex, { overlayAmount: Math.round((1 - transparency) * 100) / 100 });
                }}
                className="w-28 accent-[var(--csc-accent)]"
              />
              <label className="flex items-center gap-2 text-[11px] text-gray-400">
                Color
                <input
                  type="color"
                  aria-label="Overlay color"
                  title="Color of the wash behind the words"
                  value={slide.overlayColor || slidePlates.primaryColor}
                  className="h-6 w-8 cursor-pointer bg-transparent"
                  onChange={(event) => updateSlide(slideIndex, { overlayColor: event.target.value.toUpperCase() })}
                />
              </label>
            </div>
          ) : null}

          <details className="shrink-0 rounded-lg border border-white/10 px-3 py-2">
            <summary className="cursor-pointer text-xs text-gray-300">
              Video
              <span className="ml-2 font-normal text-gray-500">{videoSummary}</span>
            </summary>
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="w-full sm:w-52"
                  title="The show can belong to a garden, a bloom, or both. Video comes from the bloom."
                >
                  <SettingsSelect
                    ariaLabel="Song Garden"
                    value={show.gardenId ?? ""}
                    onChange={(gardenId) => update({ ...show, gardenId: gardenId || null })}
                  >
                    <option value="">No garden</option>
                    {gardens.map((garden) => (
                      <option key={garden.id} value={garden.id}>
                        {garden.title}
                      </option>
                    ))}
                  </SettingsSelect>
                </div>
                <div className="w-full sm:w-60" title={videoNote ?? "Video loops from the bloom."}>
                  <SettingsSelect
                    ariaLabel="Bloom"
                    value={show.bloomId || background.bloom?.id || ""}
                    onChange={(bloomId) => update({ ...show, bloomId: bloomId || null })}
                  >
                    <option value="">{show.match ? "Match a bloom named Gather" : "No bloom"}</option>
                    {blooms.map((bloom) => (
                      <option key={bloom.id} value={bloom.id}>
                        {bloom.title}
                      </option>
                    ))}
                    {background.bloom && !blooms.some((bloom) => bloom.id === background.bloom?.id) ? (
                      <option value={background.bloom.id}>{background.bloom.title}</option>
                    ) : null}
                  </SettingsSelect>
                </div>
                {background.bloom ? (
                  <Link href={`/admin/events/${background.bloom.id}`} className="csc-link shrink-0 text-xs">
                    Open bloom
                  </Link>
                ) : null}
                <div className="w-full sm:w-52" title="This slide can use its own bloom. Leave it on the show when every slide shares one.">
                  <SettingsSelect
                    ariaLabel="Slide bloom"
                    value={slide.bloomId ?? ""}
                    onChange={(bloomId) => updateSlide(slideIndex, { bloomId: bloomId || null })}
                  >
                    <option value="">Show&apos;s bloom</option>
                    {blooms.map((bloom) => (
                      <option key={bloom.id} value={bloom.id}>
                        {bloom.title}
                      </option>
                    ))}
                    {slide.bloomId && !blooms.some((bloom) => bloom.id === slide.bloomId) ? (
                      <option value={slide.bloomId}>{slideBloomTitle}</option>
                    ) : null}
                  </SettingsSelect>
                </div>
                <SettingsButton
                  variant={slide.motion === "return" ? "ghost" : "primary"}
                  title="The clip plays forward and cuts back to the start."
                  onClick={() => updateSlide(slideIndex, { motion: undefined })}
                >
                  Loop
                </SettingsButton>
                <SettingsButton
                  variant={slide.motion === "return" ? "primary" : "ghost"}
                  title="The clip plays forward, then back, so the loop does not jump."
                  onClick={() => updateSlide(slideIndex, { motion: "return" })}
                >
                  Forward and back
                </SettingsButton>
                <label className="flex items-center gap-2 text-[11px] text-gray-400">
                  Speed {Math.round((slide.speed ?? 1) * 100)}%
                  <input
                    type="range"
                    min={25}
                    max={100}
                    step={5}
                    aria-label="Video speed"
                    title="100% is normal. Lower is slow motion."
                    value={Math.round((slide.speed ?? 1) * 100)}
                    onChange={(event) => updateSlide(slideIndex, { speed: Number(event.target.value) / 100 })}
                    className="w-24 accent-[var(--csc-accent)]"
                  />
                </label>
                {slidePlates.loops.length > 0 ? (
                  <SettingsButton
                    onClick={() => {
                      const slides = show.slides.map((item, index) => ({
                        ...item,
                        loopIndex: index % slidePlates.loops.length,
                      }));
                      update({ ...show, slides });
                    }}
                  >
                    Use in order
                  </SettingsButton>
                ) : null}
              </div>
              {videoNote ? <p className="text-[11px] text-gray-500">{videoNote}</p> : null}
              {slidePlates.loops.length > 0 ? (
                <div
                  className="flex gap-1.5 overflow-x-auto pb-1"
                  title="Background plates, in the order the bloom plays them."
                >
                  {slidePlates.loops.map((item, index) => {
                    const plateOn = Math.min(slide.loopIndex, slidePlates.loops.length - 1) === index;
                    return (
                      <button
                        key={`${item.label}-${item.videoUrl ?? item.sceneUrl}-${index}`}
                        type="button"
                        aria-pressed={plateOn}
                        aria-label={`Use ${item.label}`}
                        onClick={() => updateSlide(slideIndex, { loopIndex: index })}
                        className={`relative h-12 w-20 shrink-0 overflow-hidden rounded-md border ${
                          plateOn ? "border-[var(--csc-accent)]" : "border-white/15"
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
                        <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-white">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </details>
          <div className="hidden min-h-0 flex-1 lg:block" />
        </section>
      </div>
    </div>
  );
}
