"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ShowStage from "@/components/show/ShowStage";
import {
  exitDeckFullscreen,
  fullscreenAvailable,
  isDeckFullscreen,
  requestDeckFullscreen,
} from "@/lib/pitches/present";
import {
  nextLyricCue,
  normalizeShow,
  pickLoop,
  revealedLines,
  type LyricCue,
  type ShowDeck,
  type ShowLoop,
} from "@/lib/show-slides/model";

type Background = {
  bloom: { id: string; slug: string; title: string } | null;
  primaryColor: string;
  accentColor: string;
  loops: ShowLoop[];
};

type ShowPresentProps = {
  show: ShowDeck;
  background: Background;
  /** Plates for slides that name their own bloom. */
  bloomBackgrounds?: Record<string, Background>;
};

function draftKey(id: string): string {
  return `csc-show-draft:${id}`;
}

export default function ShowPresent({ show: initial, background, bloomBackgrounds = {} }: ShowPresentProps) {
  const [show, setShow] = useState(initial);
  const [cue, setCue] = useState<LyricCue>({ slide: 0, revealed: 0 });
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(initial.id));
      if (!raw) return;
      const draft = normalizeShow(JSON.parse(raw));
      if (draft && draft.updatedAt >= initial.updatedAt) setShow(draft);
    } catch {
      /* ignore a bad draft */
    }
  }, [initial]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "ArrowRight" || event.key === " " || event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        setCue((current) => nextLyricCue(current, show.slides, "next"));
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "Backspace" || event.key === "PageUp") {
        event.preventDefault();
        setCue((current) => nextLyricCue(current, show.slides, "prev"));
      } else if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        void toggleFullscreen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show.slides]);

  useEffect(() => {
    function onChange() {
      const root = document.getElementById("show-stage");
      setFullscreen(Boolean(root && isDeckFullscreen(root)));
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    const root = document.getElementById("show-stage");
    if (!root) return;
    if (isDeckFullscreen(root)) {
      await exitDeckFullscreen();
      return;
    }
    if (fullscreenAvailable(root)) await requestDeckFullscreen(root).catch(() => undefined);
  }

  const index = Math.max(0, Math.min(show.slides.length - 1, cue.slide));
  const slide = show.slides[index];
  const lines = revealedLines(slide, cue.revealed);
  const plates = (slide?.bloomId && bloomBackgrounds[slide.bloomId]) || background;
  const loop = pickLoop(plates.loops, slide?.loopIndex ?? 0);

  return (
    <div id="show-stage" className="fixed inset-0 bg-black text-white">
      {slide ? (
        <ShowStage
          lines={lines}
          font={slide.font}
          sizePx={slide.sizePx}
          showLogo={slide.showLogo}
          logoWidth={slide.logoWidth}
          logoAnchor={slide.logoAnchor}
          treatment={slide.treatment === "overlay" ? "overlay" : "card"}
          overlayColor={slide.overlayColor}
          overlayAmount={slide.overlayAmount}
          loop={loop}
          primaryColor={plates.primaryColor}
          accentColor={plates.accentColor}
          interactive
          hint={lines.length === 0 ? "Click or press space" : null}
          onAdvance={(direction) => setCue((current) => nextLyricCue(current, show.slides, direction))}
        />
      ) : null}
      <div className="fixed right-4 top-4 z-20 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
        <button type="button" className="hover:text-white" onClick={() => void toggleFullscreen()}>
          {fullscreen ? "Window" : "Fill screen"}
        </button>
        <Link href={`/admin/shows/${show.id}`} className="hover:text-white">
          Edit
        </Link>
      </div>
    </div>
  );
}
