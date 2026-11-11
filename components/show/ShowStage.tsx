"use client";

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import LoopingVideo from "@/components/song-garden-v2/LoopingVideo";
import { lyricFontClass } from "@/components/show/lyric-fonts";
import { slideGesture } from "@/lib/pitches/slideshow";
import {
  clampLogoWidth,
  LOGO_WIDTH_DEFAULT,
  lyricLineHeight,
  SHOW_LOGO_SRC,
  stageScale,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  type LogoAnchor,
  type LyricFontId,
  type ShowLoop,
} from "@/lib/show-slides/model";

type ShowStageProps = {
  lines: string[];
  font: LyricFontId;
  sizePx: number;
  loop: ShowLoop | null;
  showLogo?: boolean;
  logoWidth?: number;
  logoAnchor?: LogoAnchor;
  primaryColor: string;
  accentColor: string;
  interactive?: boolean;
  onAdvance?: (direction: "next" | "prev") => void;
  hint?: string | null;
};

export default function ShowStage({
  lines,
  font,
  sizePx,
  loop,
  showLogo = true,
  logoWidth = LOGO_WIDTH_DEFAULT,
  logoAnchor = "left",
  primaryColor,
  accentColor,
  interactive = false,
  onAdvance,
  hint,
}: ShowStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [fitted, setFitted] = useState(sizePx);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const apply = () => {
      const rect = host.getBoundingClientRect();
      setScale(stageScale(rect.width, rect.height));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const text = textRef.current;
    if (!frame || !text) return;
    const fit = () => {
      const availableH = frame.clientHeight;
      const availableW = frame.clientWidth;
      if (availableH <= 0 || availableW <= 0) return;
      const fits = (px: number) => {
        text.style.fontSize = `${px}px`;
        text.style.lineHeight = String(lyricLineHeight(px));
        return text.scrollHeight <= availableH + 1 && text.scrollWidth <= availableW + 1;
      };
      let next = sizePx;
      if (!fits(sizePx)) {
        let lo = 20;
        let hi = sizePx;
        for (let i = 0; i < 10; i += 1) {
          const mid = (lo + hi) / 2;
          if (fits(mid)) lo = mid;
          else hi = mid;
        }
        next = lo;
        text.style.fontSize = `${next}px`;
        text.style.lineHeight = String(lyricLineHeight(next));
      }
      const rounded = Math.round(next);
      setFitted((prev) => (prev === rounded ? prev : rounded));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    const fonts = document.fonts?.ready.then(fit);
    return () => {
      observer.disconnect();
      void fonts;
    };
  }, [lines, font, sizePx, scale]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive) return;
    pointerRef.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive || !onAdvance) return;
    const start = pointerRef.current;
    pointerRef.current = null;
    if (!start) return;
    const host = hostRef.current;
    const rect = host?.getBoundingClientRect();
    const direction = slideGesture({
      dx: event.clientX - start.x,
      dy: event.clientY - start.y,
      x: rect ? event.clientX - rect.left : event.clientX,
      width: rect?.width || window.innerWidth,
      interactive: false,
    });
    if (direction === "none") return;
    onAdvance(direction);
  }

  const card = lines.length > 0;
  const shrunk = card && fitted < sizePx - 1;

  return (
    <div
      ref={hostRef}
      data-stage={`${STAGE_WIDTH}x${STAGE_HEIGHT}`}
      data-fitted={fitted}
      className="relative h-full w-full overflow-hidden bg-black"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: STAGE_WIDTH * scale,
          height: STAGE_HEIGHT * scale,
          transform: "translate(-50%, -50%)",
        }}
      >
        <div
          className="relative overflow-hidden bg-black"
          style={{
            width: STAGE_WIDTH,
            height: STAGE_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <StagePlate loop={loop} primaryColor={primaryColor} />
          {showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={SHOW_LOGO_SRC}
              alt="Crowdsource Choir"
              className="pointer-events-none absolute z-20"
              style={
                logoAnchor === "center"
                  ? {
                      width: clampLogoWidth(logoWidth),
                      left: "50%",
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                    }
                  : { width: clampLogoWidth(logoWidth), left: 48, top: 36 }
              }
            />
          ) : null}
          {card ? (
            <div
              className="absolute left-1/2 top-1/2"
              style={{ width: 1560, height: 820, transform: "translate(-50%, -50%)" }}
            >
              <div
                className="flex h-full w-full items-center justify-center rounded-[28px] px-[72px] py-[64px]"
                style={{
                  background: `linear-gradient(165deg, color-mix(in srgb, ${primaryColor} 84%, transparent) 0%, color-mix(in srgb, ${primaryColor} 76%, transparent) 55%, color-mix(in srgb, ${primaryColor} 70%, ${accentColor}) 100%)`,
                  backdropFilter: "blur(16px) saturate(1.12)",
                  WebkitBackdropFilter: "blur(16px) saturate(1.12)",
                  border: `1px solid color-mix(in srgb, ${accentColor} 48%, transparent)`,
                  boxShadow: "0 18px 48px -18px rgba(0,0,0,0.6), inset 0 1px 0 color-mix(in srgb, " + accentColor + " 30%, transparent)",
                }}
              >
                <div ref={frameRef} className="h-full w-full overflow-hidden">
                  <div
                    ref={textRef}
                    role="region"
                    aria-live="polite"
                    aria-label="Lyrics"
                    className={`${lyricFontClass[font]} flex h-full w-full flex-col items-center justify-center text-balance text-center text-white`}
                    style={{
                      fontSize: sizePx,
                      lineHeight: lyricLineHeight(sizePx),
                      fontWeight: sizePx >= 120 ? 600 : 500,
                      textShadow: "0 1px 2px rgba(0,0,0,0.75), 0 2px 18px rgba(0,0,0,0.45)",
                    }}
                  >
                    {lines.map((line, index) => (
                      <p
                        key={`${index}-${line}`}
                        className={index === lines.length - 1 ? "lyric-line-in m-0 max-w-full break-words" : "m-0 max-w-full break-words"}
                        style={{ marginTop: index === 0 ? 0 : "0.14em" }}
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {hint ? (
            <p
              className="absolute bottom-10 left-0 right-0 text-center text-[22px] font-medium uppercase tracking-[0.22em]"
              style={{ color: accentColor }}
            >
              {hint}
            </p>
          ) : null}
          {shrunk ? (
            <p className="absolute bottom-10 right-12 text-[18px] uppercase tracking-[0.16em] text-white/70">
              Fit {fitted}px
            </p>
          ) : null}
        </div>
      </div>
      <style jsx>{`
        .lyric-line-in {
          animation: lyric-line-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes lyric-line-in {
          from {
            opacity: 0;
            transform: translate3d(0, 28px, 0);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .lyric-line-in {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

function StagePlate({ loop, primaryColor }: { loop: ShowLoop | null; primaryColor: string }) {
  if (loop?.videoUrl) {
    return <LoopingVideo src={loop.videoUrl} poster={loop.sceneUrl ?? undefined} veilColor={primaryColor} />;
  }
  if (loop?.sceneUrl) {
    return (
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('${loop.sceneUrl}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    );
  }
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `radial-gradient(120% 80% at 50% 42%, color-mix(in srgb, ${primaryColor} 72%, #241608) 0%, #050505 72%)`,
      }}
    />
  );
}
