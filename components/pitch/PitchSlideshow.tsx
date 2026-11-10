"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { CopyBlock, PitchSlide } from "@/app/sobeca-song-garden/content";
import { GradedPhoto } from "@/components/pitch/GradedPhoto";
import { PitchText } from "@/components/pitch/PitchText";
import { pitchFollowMargin } from "@/lib/pitches/block-space";
import { evenFitScale } from "@/lib/pitches/fit-copy";
import { plainPitchText } from "@/lib/pitches/rich-text";
import {
  exitDeckFullscreen,
  fullscreenAvailable,
  isDeckFullscreen,
  nudgeMobileChrome,
  prefersImmersiveFallback,
  requestDeckFullscreen,
  startWindowedPresent,
  type PresentMode,
} from "@/lib/pitches/present";
import { copySteps, nextPresentStep, punchCopy, slideGesture, type SlideGesture } from "@/lib/pitches/slideshow";

const OVERLAYS = ["#CFFF81", "#FF2D95", "#C026D3"] as const;

// Injected as HTML so the browser's CSS parser cannot hydrate-mismatch the text node.
const DECK_CSS = `
@keyframes photo-in-next {
  from { opacity: 0.35; transform: scale(1.18) translate3d(4%, 1%, 0); }
  to { opacity: 1; transform: scale(1.05) translate3d(0, 0, 0); }
}
@keyframes photo-in-prev {
  from { opacity: 0.35; transform: scale(1.18) translate3d(-4%, 1%, 0); }
  to { opacity: 1; transform: scale(1.05) translate3d(0, 0, 0); }
}
@keyframes copy-in {
  from { opacity: 0; transform: translate3d(0, 42px, 0); filter: blur(8px); }
  to { opacity: 1; transform: none; filter: none; }
}
@keyframes photo-out-next {
  to { opacity: 0; transform: scale(1.02) translate3d(-6%, 0, 0); }
}
@keyframes photo-out-prev {
  to { opacity: 0; transform: scale(1.02) translate3d(6%, 0, 0); }
}
@keyframes wash-in {
  from { opacity: 0; }
  to { opacity: var(--wash); }
}
@keyframes rule-in {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
.slide-photo { animation: photo-in-next 1.25s cubic-bezier(0.16, 1, 0.3, 1) both; }
.slide-out { animation: photo-out-next 0.8s cubic-bezier(0.4, 0, 0.2, 1) both; }
[data-direction="prev"] .slide-out { animation-name: photo-out-prev; }
[data-direction="prev"] .slide-photo { animation-name: photo-in-prev; }
.slide-wash { animation: wash-in 0.9s ease both; }
.slide-line { animation: copy-in 0.95s cubic-bezier(0.16, 1, 0.3, 1) both; }
.slide-rule { transform-origin: left center; animation: rule-in 0.8s 0.28s cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes punch-in {
  from { opacity: 0; transform: translate3d(0, 36px, 0); filter: blur(6px); }
  to { opacity: 1; transform: none; filter: none; }
}
.punch-in { animation: punch-in 0.75s cubic-bezier(0.16, 1, 0.3, 1) both; }
.deck-still .punch-in { animation: none; }
.deck-still .slide-photo,
.deck-still .slide-out,
.deck-still .slide-wash,
.deck-still .slide-line,
.deck-still .slide-rule { animation: none; }
@media (prefers-reduced-motion: reduce) {
  .slide-photo, .slide-out, .slide-wash, .slide-line, .slide-rule, .punch-in { animation: none; }
}
`;

function weight(block: { bold?: boolean }): string {
  return block.bold ? " font-bold" : "";
}

function Block({
  block,
  display,
  footer = false,
  previous,
}: {
  block: CopyBlock;
  display: string;
  footer?: boolean;
  previous?: CopyBlock["type"];
}) {
  const follow = pitchFollowMargin(block.type, previous, footer);
  if (block.type === "title") {
    return (
      <h1 className={`${display} max-w-5xl break-words text-6xl uppercase leading-[0.84] tracking-wide sm:text-8xl lg:text-9xl${weight(block)}`}>
        <PitchText text={block.text} />
      </h1>
    );
  }
  if (block.type === "heading") {
    return (
      <h2 className={`${display} max-w-5xl break-words text-5xl uppercase leading-[0.86] tracking-wide sm:text-7xl lg:text-8xl${weight(block)}`}>
        <PitchText text={block.text} />
      </h2>
    );
  }
  if (block.type === "heading2") {
    return (
      <h3 className={`${display} ${follow} flex max-w-4xl items-start gap-3 text-3xl leading-[0.9] tracking-wide sm:text-4xl lg:text-5xl${weight(block)}`}>
        <span aria-hidden="true" className="h-[1lh] w-0.5 shrink-0 bg-[#CFFF81]" />
        <span className="min-w-0 break-words">
          <PitchText text={block.text} />
        </span>
      </h3>
    );
  }
  if (block.type === "heading3") {
    return (
      <h4 className={`${follow} flex max-w-5xl items-start gap-4 pl-8 text-3xl leading-snug tracking-wide sm:pl-12 sm:text-4xl lg:text-5xl${weight(block)}`}>
        <span aria-hidden="true" className="mt-[0.45em] h-[0.28em] w-[0.28em] shrink-0 rounded-full bg-[#CFFF81]" />
        <span className="min-w-0 break-words">
          <PitchText text={block.text} />
        </span>
      </h4>
    );
  }
  if (block.type === "kicker") {
    return (
      <p className={`mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81] sm:text-sm${weight(block)}`}>
        <PitchText text={block.text} />
      </p>
    );
  }
  if (block.type === "line") {
    return (
      <p className={`${display} mt-8 max-w-4xl break-words text-3xl uppercase leading-[0.92] text-[#CFFF81] sm:text-5xl${weight(block)}`}>
        <PitchText text={block.text} />
      </p>
    );
  }
  if (block.type === "paragraph") {
    const tight = previous === "heading2";
    return (
      <p
        className={`max-w-3xl break-words text-base sm:text-lg${weight(block)} ${tight ? "leading-snug" : "leading-relaxed"} ${
          tight && !block.rule ? "pl-4" : ""
        } ${block.rule ? "flex items-start gap-3" : ""} ${footer ? "text-white/85" : follow}`}
      >
        {block.rule ? <span aria-hidden="true" className="h-[1lh] w-0.5 shrink-0 bg-[#CFFF81]" /> : null}
        {block.rule ? (
          <span className="min-w-0">
            <PitchText text={block.text} />
          </span>
        ) : (
          <PitchText text={block.text} />
        )}
      </p>
    );
  }
  if (block.type === "image") {
    return <img src={block.src} alt={block.alt} className="mt-8 w-full max-w-4xl" />;
  }
  if (block.type === "list") {
    return (
      <ul className="mt-6 max-w-3xl space-y-2 text-base leading-relaxed sm:text-lg">
        {block.items.map((item, index) => (
          <li key={`${index}-${item}`} className="border-l-2 border-[#CFFF81] pl-4">
            {item}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="mt-6 max-w-5xl overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm sm:text-base">
        <thead>
          <tr>
            {block.headers.map((header) => (
              <th key={header} className="border-b border-[#CFFF81] py-3 pr-6 font-bold uppercase tracking-[0.14em] text-[#CFFF81]">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row.join("|")}`} className="align-top">
              {row.map((cell, index) => (
                <td
                  key={`${rowIndex}-${index}`}
                  className={`border-b border-white/15 py-3 pr-6 leading-relaxed ${index === 0 ? "text-[#CFFF81]" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FitCopy({ children, watch, color }: { children: ReactNode; watch: string; color?: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const box = boxRef.current;
    if (!frame || !box) return;

    const apply = () => {
      if (!frame.isConnected || !box.isConnected) return;
      box.style.transform = "none";
      const scale = evenFitScale(frame.clientWidth, frame.clientHeight, box.scrollWidth, box.scrollHeight);
      box.style.transformOrigin = "top left";
      box.style.transform = scale < 0.999 ? `scale(${scale})` : "none";
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(frame);
    const fonts = document.fonts?.ready.then(apply);
    return () => {
      observer.disconnect();
      void fonts;
    };
  }, [watch]);

  return (
    <div ref={frameRef} data-slide-copy className="min-h-0 min-w-0 flex-1 overflow-hidden" style={{ color }}>
      <div ref={boxRef} className="w-full">
        {children}
      </div>
    </div>
  );
}

function steppedBlock(block: CopyBlock, blockIndex: number, visible: Set<string> | null): CopyBlock | null {
  if (!visible) return block;
  if (block.type === "list") {
    const items = block.items.filter((item, itemIndex) => item.trim() && visible.has(`${blockIndex}:i${itemIndex}`));
    return items.length ? { ...block, items } : null;
  }
  if (block.type === "table") {
    const rows = block.rows.filter((_, rowIndex) => visible.has(`${blockIndex}:r${rowIndex}`));
    return rows.length ? { ...block, rows } : null;
  }
  return visible.has(String(blockIndex)) ? block : null;
}

function SlideCopy({
  slide,
  display,
  arrived,
}: {
  slide: PitchSlide;
  display: string;
  arrived: number | null;
}) {
  const visible =
    arrived === null
      ? null
      : new Set(
          copySteps(slide.blocks)
            .slice(0, arrived)
            .map((step) =>
              typeof step.itemIndex === "number"
                ? `${step.blockIndex}:i${step.itemIndex}`
                : typeof step.rowIndex === "number"
                  ? `${step.blockIndex}:r${step.rowIndex}`
                  : String(step.blockIndex),
            ),
        );
  const punch = visible ? null : punchCopy(slide.blocks);
  return (
    <div>
      {slide.blocks.map((block, blockIndex) => {
        const shown = steppedBlock(block, blockIndex, visible);
        if (!shown) return null;
        const previous = slide.blocks[blockIndex - 1]?.type;
        if (punch && blockIndex === punch.index) {
          if (!punch.before) return null;
          return (
            <div key={`${slide.id}-${blockIndex}`} className="slide-line" style={{ animationDelay: `${140 + blockIndex * 90}ms` }}>
              <p className="mt-5 max-w-3xl text-base leading-relaxed sm:text-lg">
                <PitchText text={punch.before} />
              </p>
            </div>
          );
        }
        return (
          <div key={`${slide.id}-${blockIndex}`} className="slide-line" style={{ animationDelay: `${140 + blockIndex * 90}ms` }}>
            <Block block={shown} display={display} previous={previous} />
          </div>
        );
      })}
    </div>
  );
}

export default function PitchSlideshow({
  slides,
  displayClass,
  monoClass,
}: {
  slides: PitchSlide[];
  displayClass: string;
  monoClass: string;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const startRef = useRef<{ x: number; y: number; interactive: boolean } | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [arrived, setArrived] = useState(0);
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const [direction, setDirection] = useState<Exclude<SlideGesture, "none">>("next");
  const [motion, setMotion] = useState(true);
  const [presentMode, setPresentMode] = useState<PresentMode>("off");
  const [playNote, setPlayNote] = useState<string | null>(null);
  const presentModeRef = useRef<PresentMode>("off");
  const shown = useRef(0);
  const indexRef = useRef(0);
  const revealedRef = useRef(false);
  const arrivedRef = useRef(0);
  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  const presenting = presentMode !== "off";

  const setPresent = useCallback((mode: PresentMode) => {
    presentModeRef.current = mode;
    setPresentMode(mode);
  }, []);

  const go = useCallback((gesture: SlideGesture) => {
    const deck = slidesRef.current;
    const current = indexRef.current;
    const next = nextPresentStep(
      { index: current, revealed: revealedRef.current, arrived: arrivedRef.current },
      deck,
      gesture,
    );
    if (next.index !== current && gesture !== "none") setDirection(gesture === "prev" ? "prev" : "next");
    indexRef.current = next.index;
    revealedRef.current = next.revealed;
    arrivedRef.current = next.arrived;
    setIndex(next.index);
    setRevealed(next.revealed);
    setArrived(next.arrived);
  }, []);

  useEffect(() => {
    if (shown.current === index) return;
    const previous = shown.current;
    shown.current = index;
    if (!motion) {
      setOutgoing(null);
      return;
    }
    setOutgoing(previous);
    const timer = window.setTimeout(() => setOutgoing(null), 900);
    return () => window.clearTimeout(timer);
  }, [index, motion]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setMotion(!media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        go("next");
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go("prev");
      } else if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        if (presentModeRef.current === "off") play();
        else void toggleMonitorFullscreen();
      } else if (event.key === "Escape" && presentModeRef.current === "immersive") {
        event.preventDefault();
        setPresent("off");
        setPlayNote(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, setPresent]);

  useEffect(() => {
    const sync = () => {
      const root = rootRef.current;
      if (!root) return;
      if (isDeckFullscreen(root)) {
        setPresent("fullscreen");
        setPlayNote(null);
        return;
      }
      // Leaving monitor fullscreen returns to windowed present, not a full stop.
      if (presentModeRef.current === "fullscreen") {
        setPresent("immersive");
        setPlayNote(null);
      }
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [setPresent]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtml = html.style.overflow;
    const previousBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = previousHtml;
      body.style.overflow = previousBody;
    };
  }, []);

  useEffect(() => {
    if (!playNote) return;
    const timer = window.setTimeout(() => setPlayNote(null), 4500);
    return () => window.clearTimeout(timer);
  }, [playNote]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let wheelLock = false;
    const onTouchMove = (event: TouchEvent) => {
      const start = startRef.current;
      const touch = event.touches[0];
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) event.preventDefault();
    };
    const onWheel = (event: WheelEvent) => {
      const copy = (event.target as HTMLElement | null)?.closest("[data-slide-copy]");
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (copy instanceof HTMLElement && copy.scrollHeight > copy.clientHeight + 4) {
        const atStart = copy.scrollTop <= 2;
        const atEnd = copy.scrollTop + copy.clientHeight >= copy.scrollHeight - 2;
        if ((delta > 0 && !atEnd) || (delta < 0 && !atStart)) return;
      }
      event.preventDefault();
      if (wheelLock || Math.abs(delta) < 24) return;
      wheelLock = true;
      go(delta > 0 ? "next" : "prev");
      window.setTimeout(() => {
        wheelLock = false;
      }, 650);
    };
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("wheel", onWheel);
    };
  }, [go]);

  const slide = slides[index];
  if (!slide) return null;
  const tint = OVERLAYS[index % OVERLAYS.length];
  const wash = typeof slide.wash === "number" ? slide.wash : 0.45;
  const label = `${String(index + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;

  async function stopPresenting() {
    const root = rootRef.current;
    setPlayNote(null);
    if (root && isDeckFullscreen(root)) {
      try {
        await exitDeckFullscreen();
      } catch {
        /* soft exit still clears presentation */
      }
    }
    setPresent("off");
  }

  /** Play stays in the browser window so Meet/Zoom window-share still shows other apps. */
  function play() {
    if (presentModeRef.current !== "off") {
      void stopPresenting();
      return;
    }
    const coarse = prefersImmersiveFallback();
    const started = startWindowedPresent({ coarsePointer: coarse });
    setPresent(started.mode);
    setPlayNote(started.note);
    if (coarse) nudgeMobileChrome();
  }

  async function toggleMonitorFullscreen() {
    const root = rootRef.current;
    if (!root) return;
    setPlayNote(null);
    if (isDeckFullscreen(root) || presentModeRef.current === "fullscreen") {
      try {
        await exitDeckFullscreen();
      } catch {
        setPresent("immersive");
      }
      return;
    }
    if (!fullscreenAvailable(root)) {
      setPlayNote("This browser cannot take the whole screen. Stay in the window, or press F11.");
      return;
    }
    try {
      await requestDeckFullscreen(root);
      if (isDeckFullscreen(root)) {
        setPresent("fullscreen");
        return;
      }
      throw new Error("Fullscreen did not stick.");
    } catch {
      setPresent("immersive");
      setPlayNote("Could not take the whole screen. Presenting in this window instead.");
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    startRef.current = {
      x: event.clientX,
      y: event.clientY,
      interactive: Boolean(target?.closest("button, a, input, textarea, label")),
    };
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;
    const rect = event.currentTarget.getBoundingClientRect();
    go(
      slideGesture({
        dx: event.clientX - start.x,
        dy: event.clientY - start.y,
        x: event.clientX - rect.left,
        width: rect.width,
        interactive: start.interactive,
      }),
    );
  }

  return (
    <main
      ref={rootRef}
      className={`${monoClass} fixed inset-0 z-10 cursor-pointer overflow-hidden bg-black text-white ${motion ? "" : "deck-still"}`}
      data-direction={direction}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        startRef.current = null;
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: DECK_CSS }} />

      <div key={`${slide.id}-photo`} className="slide-photo absolute inset-0">
        <GradedPhoto src={slide.image} alt={slide.imageAlt} overlay={slide.photoOverlay} className="h-full w-full" />
      </div>
      {outgoing !== null && slides[outgoing] ? (
        <div className="slide-out absolute inset-0">
          <GradedPhoto src={slides[outgoing].image} alt="" overlay={slides[outgoing].photoOverlay} className="h-full w-full" />
        </div>
      ) : null}
      <div
        key={`${slide.id}-wash`}
        className="slide-wash absolute inset-0 mix-blend-multiply"
        style={{ backgroundColor: tint, ["--wash" as string]: wash, opacity: wash }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25" />
      <div className="slide-rule absolute left-0 top-0 h-1 w-full bg-[#CFFF81]" />

      <div className={`relative z-10 flex h-full min-w-0 flex-col px-6 pt-8 sm:px-24 sm:pt-10 ${revealed && slide.reveal !== "steps" && punchCopy(slide.blocks) ? "pb-40 sm:pb-48" : "pb-24 sm:pb-28"}`}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <img src="/sobeca-song-garden/logo.png" alt="Crowdsource Choir" className="slide-line h-9 w-auto sm:h-11" />
          <div className="flex items-center gap-1 sm:gap-2">
            {presenting ? (
              <>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center text-[#CFFF81] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] transition-opacity hover:opacity-90"
                  aria-label={presentMode === "fullscreen" ? "Stay in this window" : "Fill the whole screen"}
                  title={
                    presentMode === "fullscreen"
                      ? "Back to this browser window"
                      : "Fill the whole screen (hides the address bar and tabs)"
                  }
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    void toggleMonitorFullscreen();
                  }}
                >
                  {presentMode === "fullscreen" ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path
                        d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path
                        d="M3 9V5a2 2 0 0 1 2-2h4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4M21 15v4a2 2 0 0 1-2 2h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center text-white/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] transition-colors hover:text-white"
                  aria-label="Exit presentation"
                  title="Leave presentation"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    void stopPresenting();
                  }}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center text-[#CFFF81] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] transition-opacity hover:opacity-90"
                aria-label="Play presentation in this window"
                title="Present in this window. Expand later for the whole screen."
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  play();
                }}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path d="M8 5.2v13.6l12-6.8L8 5.2z" fill="currentColor" />
                </svg>
              </button>
            )}
            <p className="ml-1 text-[11px] uppercase tracking-[0.28em] text-white/80 sm:ml-2">{label}</p>
          </div>
        </div>
        <FitCopy watch={`${slide.id}:${revealed}:${arrived}`} color={slide.copyColor || "#FFFFFF"}>
          <SlideCopy slide={slide} display={displayClass} arrived={slide.reveal === "steps" ? arrived : null} />
        </FitCopy>
      </div>

      {revealed && slide.reveal !== "steps" && punchCopy(slide.blocks) ? (
        <p
          key={`${slide.id}-punch`}
          className={`${displayClass} punch-in pointer-events-none absolute bottom-16 left-6 right-6 z-20 max-w-4xl text-2xl uppercase leading-[0.95] text-[#CFFF81] sm:bottom-20 sm:left-24 sm:right-24 sm:text-4xl`}
        >
          {plainPitchText(punchCopy(slide.blocks)?.text ?? "")}
        </p>
      ) : null}

      {playNote ? (
        <p className="absolute bottom-14 left-1/2 z-30 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 bg-black/85 px-3 py-2 text-center text-xs text-[#CFFF81]">
          {playNote}
        </p>
      ) : null}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex items-center justify-center gap-2">
        {slides.map((item, dot) => (
          <button
            key={item.id}
            type="button"
            aria-label={`Slide ${dot + 1}`}
            aria-current={dot === index ? "true" : undefined}
            className={`h-1.5 rounded-full transition-all duration-500 ${dot === index ? "w-8 bg-[#CFFF81]" : "w-2 bg-white/45 hover:bg-white"}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              setDirection(dot > index ? "next" : "prev");
              indexRef.current = dot;
              revealedRef.current = false;
              arrivedRef.current = 0;
              setRevealed(false);
              setArrived(0);
              setIndex(dot);
            }}
          />
        ))}
      </div>
    </main>
  );
}
