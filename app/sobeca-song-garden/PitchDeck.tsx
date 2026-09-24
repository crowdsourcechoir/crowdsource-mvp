"use client";

import { useEffect, useRef } from "react";
import type { CopyBlock, PitchSlide } from "./content";

const OVERLAYS = ["#CFFF81", "#FF2D95", "#C026D3"] as const;

function Block({ block, display, footer = false }: { block: CopyBlock; display: string; footer?: boolean }) {
  if (block.type === "title") {
    return (
      <h1 className={`${display} max-w-6xl text-6xl leading-[0.9] tracking-wide sm:text-8xl`}>
        {block.text}
      </h1>
    );
  }
  if (block.type === "heading") {
    return (
      <h2 className={`${display} max-w-5xl text-5xl leading-[0.92] tracking-wide text-white sm:text-7xl`}>
        {block.text}
      </h2>
    );
  }
  if (block.type === "kicker") {
    return (
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.28em] text-[#CFFF81] sm:text-sm">
        {block.text}
      </p>
    );
  }
  if (block.type === "line") {
    const cycle = block.text.includes("PLANT AGAIN");
    return (
      <p
        className={`${display} mt-8 text-[#CFFF81] ${
          cycle
            ? "max-w-none text-[clamp(1.35rem,2.35vw,3rem)] leading-none tracking-wide max-lg:whitespace-normal lg:whitespace-nowrap"
            : footer
              ? "max-w-3xl text-2xl leading-tight tracking-wide sm:text-3xl"
              : "max-w-5xl text-3xl leading-tight tracking-wide sm:text-5xl"
        }`}
      >
        {block.text}
      </p>
    );
  }
  if (block.type === "paragraph") {
    return <p className="mt-5 max-w-3xl text-base leading-relaxed text-white/95 sm:text-lg">{block.text}</p>;
  }
  if (block.type === "image") {
    return (
      <img src={block.src} alt={block.alt} className="mt-10 w-full max-w-4xl" />
    );
  }
  if (block.type === "list") {
    return (
      <ul className="mt-6 max-w-3xl space-y-2 text-base leading-relaxed text-white/95 sm:text-lg">
        {block.items.map((item) => (
          <li key={item} className="border-l-2 border-[#CFFF81] pl-4">
            {item}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="mt-8 max-w-5xl overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm sm:text-base">
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
          {block.rows.map((row) => (
            <tr key={row.join("|")} className="align-top">
              {row.map((cell, index) => (
                <td
                  key={cell}
                  className={`border-b border-white/15 py-4 pr-6 leading-relaxed ${index === 0 ? "text-[#CFFF81]" : ""}`}
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

export default function PitchDeck({
  slides,
  displayClass,
  monoClass,
}: {
  slides: PitchSlide[];
  displayClass: string;
  monoClass: string;
}) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const layers = Array.from(root.querySelectorAll<HTMLElement>("[data-parallax]"));
    let frame = 0;

    const update = () => {
      frame = 0;
      const viewH = window.innerHeight;
      for (const layer of layers) {
        const section = layer.parentElement;
        if (!section) continue;
        const rect = section.getBoundingClientRect();
        const progress = (viewH - rect.top) / (viewH + rect.height);
        const shift = (progress - 0.5) * viewH * 0.18;
        layer.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0) scale(1.12)`;
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main id="sobeca-top" ref={rootRef} className={`${monoClass} bg-black text-white`}>
      <style>{`
        @keyframes pitch-rise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: none; }
        }
        .pitch-rise { animation: pitch-rise 0.9s ease both; }
        @media (prefers-reduced-motion: reduce) {
          .pitch-rise { animation: none; }
          [data-parallax] { transform: none !important; }
        }
      `}</style>
      {slides.map((slide, index) => {
        const tint = OVERLAYS[index % OVERLAYS.length];
        return (
          <section key={slide.id} className="relative min-h-[100dvh] w-full overflow-hidden">
            <img
              data-parallax
              src={slide.image}
              alt={slide.imageAlt}
              className="absolute left-0 top-[-12%] h-[130%] w-full object-cover will-change-transform"
            />
            <div
              className="absolute inset-0 mix-blend-multiply"
              style={{ backgroundColor: tint, opacity: slide.id === "invitation" ? 0.38 : 0.72 }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/55 to-black/35" />
            <div
              className={`relative z-10 flex w-full flex-col px-6 py-16 sm:px-12 sm:py-20 lg:px-16 ${
                slide.id === "title" ? "min-h-[100dvh] justify-between" : ""
              }`}
            >
              <div>
                <a
                  href="#sobeca-top"
                  aria-label="Back to top"
                  className="pitch-rise mb-10 inline-block"
                  onClick={(event) => {
                    event.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <img src="/sobeca-song-garden/logo.png" alt="Crowdsource Choir" className="h-10 w-auto sm:h-12" />
                </a>
                {(slide.id === "title" ? slide.blocks.filter((block) => block.type === "title" || block.type === "kicker") : slide.blocks).map(
                  (block, blockIndex) => (
                    <div key={`${slide.id}-${blockIndex}`} className="pitch-rise" style={{ animationDelay: `${blockIndex * 70}ms` }}>
                      <Block block={block} display={displayClass} />
                    </div>
                  ),
                )}
              </div>
              {slide.id === "title" ? (
                <div className="max-w-3xl pb-4">
                  {slide.blocks
                    .filter((block) => block.type === "line" || block.type === "paragraph")
                    .map((block, blockIndex) => (
                      <div key={`${slide.id}-foot-${blockIndex}`} className="pitch-rise" style={{ animationDelay: `${200 + blockIndex * 80}ms` }}>
                        <Block block={block} display={displayClass} footer />
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
    </main>
  );
}
