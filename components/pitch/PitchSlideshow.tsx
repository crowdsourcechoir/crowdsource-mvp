"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { CopyBlock, PitchSlide } from "@/app/sobeca-song-garden/content";
import { PitchPointList, PitchRichText } from "@/components/pitch/PitchRichText";
import { nextDeckStep, punchCopy, slideGesture, type SlideGesture } from "@/lib/pitches/slideshow";

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
@keyframes pitch-brush-draw {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}
.pitch-brush {
  stroke-dasharray: 1;
  animation: pitch-brush-draw 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.deck-still .slide-photo,
.deck-still .slide-out,
.deck-still .slide-wash,
.deck-still .slide-line,
.deck-still .slide-rule,
.deck-still .pitch-brush { animation: none; }
@media (prefers-reduced-motion: reduce) {
  .slide-photo, .slide-out, .slide-wash, .slide-line, .slide-rule, .punch-in, .pitch-brush { animation: none; }
}
`;

function Block({
  block,
  display,
  footer = false,
}: {
  block: CopyBlock;
  display: string;
  footer?: boolean;
}) {
  if (block.type === "title") {
    return (
      <h1 className={`${display} max-w-5xl text-6xl uppercase leading-[0.84] tracking-wide sm:text-8xl lg:text-9xl`}>
        <PitchRichText text={block.text} bold={block.bold} underline={block.underline} />
      </h1>
    );
  }
  if (block.type === "heading") {
    return (
      <h2 className={`${display} max-w-5xl text-5xl uppercase leading-[0.86] tracking-wide sm:text-7xl lg:text-8xl`}>
        <PitchRichText text={block.text} bold={block.bold} underline={block.underline} />
      </h2>
    );
  }
  if (block.type === "kicker") {
    return (
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81] sm:text-sm">
        <PitchRichText text={block.text} bold={block.bold} underline={block.underline} />
      </p>
    );
  }
  if (block.type === "line") {
    return (
      <p className={`${display} mt-8 max-w-3xl text-3xl uppercase leading-[0.92] text-[#CFFF81] sm:text-5xl`}>
        <PitchRichText text={block.text} bold={block.bold} underline={block.underline} />
      </p>
    );
  }
  if (block.type === "large") {
    return (
      <p className={`max-w-3xl text-xl leading-snug sm:text-2xl ${footer ? "text-white/85" : "mt-5"}`}>
        <PitchRichText text={block.text} bold={block.bold} underline={block.underline} />
      </p>
    );
  }
  if (block.type === "paragraph") {
    return (
      <p className={`max-w-3xl text-base leading-relaxed sm:text-lg ${footer ? "text-white/85" : "mt-5"}`}>
        <PitchRichText text={block.text} bold={block.bold} underline={block.underline} />
      </p>
    );
  }
  if (block.type === "image") {
    return <img src={block.src} alt={block.alt} className="mt-8 w-full max-w-4xl" />;
  }
  if (block.type === "list") {
    return <PitchPointList items={block.items} />;
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
                  <PitchRichText text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SlideCopy({
  slide,
  display,
}: {
  slide: PitchSlide;
  display: string;
}) {
  const punch = punchCopy(slide.blocks);
  return (
    <div>
      {slide.blocks.map((block, blockIndex) => {
        if (punch && blockIndex === punch.index) {
          if (!punch.before) return null;
          return (
            <div key={`${slide.id}-${blockIndex}`} className="slide-line" style={{ animationDelay: `${140 + blockIndex * 90}ms` }}>
              <p className="mt-5 max-w-3xl text-base leading-relaxed sm:text-lg">
                <PitchRichText text={punch.before} bold={punch.bold} underline={punch.underline} />
              </p>
            </div>
          );
        }
        return (
          <div key={`${slide.id}-${blockIndex}`} className="slide-line" style={{ animationDelay: `${140 + blockIndex * 90}ms` }}>
            <Block block={block} display={display} />
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
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const [direction, setDirection] = useState<Exclude<SlideGesture, "none">>("next");
  const [motion, setMotion] = useState(true);
  const shown = useRef(0);
  const indexRef = useRef(0);
  const revealedRef = useRef(false);
  const slidesRef = useRef(slides);
  slidesRef.current = slides;

  const go = useCallback((gesture: SlideGesture) => {
    const deck = slidesRef.current;
    const current = indexRef.current;
    const slide = deck[current];
    const previous = deck[Math.max(0, current - 1)];
    const next = nextDeckStep(
      { index: current, revealed: revealedRef.current },
      deck.length,
      gesture,
      Boolean(slide && punchCopy(slide.blocks)),
      Boolean(previous && punchCopy(previous.blocks)),
    );
    if (next.index !== current && gesture !== "none") setDirection(gesture === "prev" ? "prev" : "next");
    indexRef.current = next.index;
    revealedRef.current = next.revealed;
    setIndex(next.index);
    setRevealed(next.revealed);
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

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

      <img key={`${slide.id}-photo`} src={slide.image} alt={slide.imageAlt} className="slide-photo absolute inset-0 h-full w-full object-cover" />
      {outgoing !== null && slides[outgoing] ? (
        <img
          src={slides[outgoing].image}
          alt=""
          className="slide-out absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <div
        key={`${slide.id}-wash`}
        className="slide-wash absolute inset-0 mix-blend-multiply"
        style={{ backgroundColor: tint, ["--wash" as string]: wash, opacity: wash }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25" />
      <div className="slide-rule absolute left-0 top-0 h-1 w-full bg-[#CFFF81]" />

      <div className="relative z-10 flex h-full flex-col px-6 pb-24 pt-8 sm:px-24 sm:pb-28 sm:pt-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <img src="/sobeca-song-garden/logo.png" alt="Crowdsource Choir" className="slide-line h-9 w-auto sm:h-11" />
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/80">{label}</p>
        </div>
        <div
          key={slide.id}
          data-slide-copy
          className="min-h-0 flex-1 overflow-y-auto pr-1"
          style={{ color: slide.copyColor || "#FFFFFF" }}
        >
          <SlideCopy slide={slide} display={displayClass} />
        </div>
      </div>

      {revealed && slide && punchCopy(slide.blocks) ? (
        <p
          key={`${slide.id}-punch`}
          className={`${displayClass} punch-in pointer-events-none absolute bottom-16 left-6 right-6 z-20 max-w-4xl text-2xl uppercase leading-[0.95] text-[#CFFF81] sm:bottom-20 sm:left-24 sm:right-24 sm:text-4xl`}
        >
          <PitchRichText
            text={punchCopy(slide.blocks)?.text ?? ""}
            bold={punchCopy(slide.blocks)?.bold}
            underline={punchCopy(slide.blocks)?.underline}
          />
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
              setRevealed(false);
              setIndex(dot);
            }}
          />
        ))}
      </div>
    </main>
  );
}
