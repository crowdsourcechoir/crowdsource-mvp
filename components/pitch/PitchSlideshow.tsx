"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { CopyBlock, PitchSlide } from "@/app/sobeca-song-garden/content";
import { slideGesture, stepSlide, type SlideGesture } from "@/lib/pitches/slideshow";

const OVERLAYS = ["#CFFF81", "#FF2D95", "#C026D3"] as const;

function splitLastSentence(text: string): { before: string; last: string } {
  const trimmed = text.trim();
  const parts = trimmed.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
  if (parts.length <= 1) return { before: "", last: trimmed };
  const last = parts[parts.length - 1];
  const before = trimmed.slice(0, trimmed.length - last.length).trim();
  return { before, last };
}

function closingProse(blocks: CopyBlock[]): { index: number; before: string; last: string } | null {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.type === "image") continue;
    if (block.type !== "paragraph" && block.type !== "line") return null;
    const { before, last } = splitLastSentence(block.text);
    if (!last) return null;
    return { index, before, last };
  }
  return null;
}

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
      <h1 className={`${display} max-w-5xl text-5xl uppercase leading-[0.88] tracking-wide sm:text-7xl lg:text-8xl`}>
        {block.text}
      </h1>
    );
  }
  if (block.type === "heading") {
    return (
      <h2 className={`${display} max-w-4xl text-4xl uppercase leading-[0.9] tracking-wide sm:text-6xl`}>
        {block.text}
      </h2>
    );
  }
  if (block.type === "kicker") {
    return (
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81] sm:text-sm">
        {block.text}
      </p>
    );
  }
  if (block.type === "line") {
    return (
      <p className={`${display} mt-8 max-w-3xl text-3xl uppercase leading-[0.92] text-[#CFFF81] sm:text-5xl`}>
        {block.text}
      </p>
    );
  }
  if (block.type === "paragraph") {
    return (
      <p className={`max-w-3xl text-base leading-relaxed sm:text-lg ${footer ? "text-white/85" : "mt-5"}`}>
        {block.text}
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

function ClosingLine({ text, display }: { text: string; display: string }) {
  return (
    <p className={`${display} mt-8 max-w-4xl text-4xl uppercase leading-[0.9] text-[#CFFF81] sm:text-6xl`}>
      {text}
    </p>
  );
}

function SlideCopy({
  slide,
  display,
}: {
  slide: PitchSlide;
  display: string;
}) {
  const closing = slide.id === "title" ? null : closingProse(slide.blocks);
  const top = slide.id === "title" ? slide.blocks.filter((block) => block.type === "title" || block.type === "kicker") : slide.blocks;
  const foot = slide.id === "title" ? slide.blocks.filter((block) => block.type === "line" || block.type === "paragraph") : [];

  return (
    <div className={`flex h-full flex-col ${slide.id === "title" ? "justify-between" : ""}`}>
      <div>
        {top.map((block, blockIndex) => (
          <div key={`${slide.id}-${blockIndex}`} className="slide-line" style={{ animationDelay: `${140 + blockIndex * 90}ms` }}>
            {closing && blockIndex === closing.index ? (
              <>
                {closing.before ? <p className="mt-5 max-w-3xl text-base leading-relaxed sm:text-lg">{closing.before}</p> : null}
                <ClosingLine text={closing.last} display={display} />
              </>
            ) : (
              <Block block={block} display={display} />
            )}
          </div>
        ))}
      </div>
      {foot.length > 0 ? (
        <div className="max-w-3xl pb-16">
          {foot.map((block, blockIndex) => (
            <div key={`${slide.id}-foot-${blockIndex}`} className="slide-line" style={{ animationDelay: `${320 + blockIndex * 90}ms` }}>
              <Block block={block} display={display} footer />
            </div>
          ))}
        </div>
      ) : null}
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
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const [direction, setDirection] = useState<Exclude<SlideGesture, "none">>("next");
  const [motion, setMotion] = useState(true);
  const shown = useRef(0);

  const go = useCallback(
    (gesture: SlideGesture) => {
      if (gesture === "none") return;
      setIndex((current) => {
        const next = stepSlide(current, slides.length, gesture);
        if (next !== current) setDirection(gesture);
        return next;
      });
    },
    [slides.length],
  );

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
    const root = rootRef.current;
    if (!root) return;
    const onTouchMove = (event: TouchEvent) => {
      const start = startRef.current;
      const touch = event.touches[0];
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) event.preventDefault();
    };
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => root.removeEventListener("touchmove", onTouchMove);
  }, []);

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
      <style>{`
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
        .deck-still .slide-photo,
        .deck-still .slide-out,
        .deck-still .slide-wash,
        .deck-still .slide-line,
        .deck-still .slide-rule { animation: none; }
        @media (prefers-reduced-motion: reduce) {
          .slide-photo, .slide-out, .slide-wash, .slide-line, .slide-rule { animation: none; }
        }
      `}</style>

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
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/30" />
      <div className="slide-rule absolute left-0 top-0 h-1 w-full bg-[#CFFF81]" />

      <div className="relative z-10 flex h-full flex-col px-6 pb-24 pt-8 sm:px-24 sm:pb-28 sm:pt-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <img src="/sobeca-song-garden/logo.png" alt="Crowdsource Choir" className="slide-line h-9 w-auto sm:h-11" />
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/80">{label}</p>
        </div>
        <div key={slide.id} className="min-h-0 flex-1 overflow-y-auto pr-1" style={{ color: slide.copyColor || "#FFFFFF" }}>
          <SlideCopy slide={slide} display={displayClass} />
        </div>
      </div>

      <button
        type="button"
        aria-label="Previous slide"
        className="absolute bottom-5 left-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-[#CFFF81]/70 bg-black/35 text-2xl text-[#CFFF81] backdrop-blur-sm transition duration-300 hover:scale-105 hover:bg-black/60 sm:bottom-auto sm:left-5 sm:top-1/2 sm:-translate-y-1/2"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => go("prev")}
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Next slide"
        className="absolute bottom-5 right-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-[#CFFF81]/70 bg-black/35 text-2xl text-[#CFFF81] backdrop-blur-sm transition duration-300 hover:scale-105 hover:bg-black/60 sm:bottom-auto sm:right-5 sm:top-1/2 sm:-translate-y-1/2"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => go("next")}
      >
        ›
      </button>

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
              setIndex(dot);
            }}
          />
        ))}
      </div>
    </main>
  );
}
