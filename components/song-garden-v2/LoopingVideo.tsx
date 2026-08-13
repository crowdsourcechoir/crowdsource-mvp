"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LoopingVideoProps = {
  src: string;
  poster?: string;
  /** Soft seam veil color — world primary, not a scene still (avoids double-image ghosts). */
  veilColor?: string;
  /** Fires once the poster is painted or the first video frame can play. */
  onReady?: () => void;
};

const SEAM_LEAD_SEC = 0.7;
const VEIL_IN_MS = 280;
const FILTER = "saturate(1.12) brightness(1.12) contrast(1.04)";

/**
 * Dual-buffer loop. Poster stays visible until the active buffer has a decoded
 * frame, so swaps never flash the solid world wash underneath.
 */
export default function LoopingVideo({
  src,
  poster,
  veilColor = "#0E1F24",
  onReady,
}: LoopingVideoProps) {
  const aRef = useRef<HTMLVideoElement | null>(null);
  const bRef = useRef<HTMLVideoElement | null>(null);
  const activeRef = useRef<"a" | "b">("a");
  const swappingRef = useRef(false);
  const readySentRef = useRef(false);
  const [active, setActive] = useState<"a" | "b">("a");
  const [veil, setVeil] = useState(0);
  const [showPoster, setShowPoster] = useState(Boolean(poster));
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const markReady = useCallback(() => {
    if (readySentRef.current) return;
    readySentRef.current = true;
    onReadyRef.current?.();
  }, []);

  useEffect(() => {
    readySentRef.current = false;
    setShowPoster(Boolean(poster));
    // Poster alone is enough to crossfade without flashing the wash.
    if (poster) {
      const img = new Image();
      img.onload = () => markReady();
      img.onerror = () => markReady();
      img.src = poster;
      if (img.complete) markReady();
    }
  }, [src, poster, markReady]);

  useEffect(() => {
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;

    activeRef.current = "a";
    swappingRef.current = false;
    setActive("a");
    setVeil(0);

    for (const el of [a, b]) {
      el.muted = true;
      el.playsInline = true;
      el.loop = false;
      el.preload = "auto";
      try {
        el.currentTime = 0;
      } catch {
        // ignore
      }
    }

    void a.play().catch(() => undefined);
    b.pause();

    function current(): HTMLVideoElement {
      return activeRef.current === "a" ? a! : b!;
    }

    function other(): HTMLVideoElement {
      return activeRef.current === "a" ? b! : a!;
    }

    function onPlaying() {
      setShowPoster(false);
      markReady();
    }

    function onCanPlay() {
      markReady();
    }

    async function swapAtSeam() {
      if (swappingRef.current) return;
      swappingRef.current = true;

      const next = other();
      try {
        next.currentTime = 0;
      } catch {
        // ignore
      }
      try {
        await next.play();
      } catch {
        // ignore autoplay races
      }

      // Soft darken only — avoid solid primary wash that reads as a blank screen.
      setVeil(1);

      window.setTimeout(() => {
        const prev = current();
        prev.pause();
        try {
          prev.currentTime = 0;
        } catch {
          // ignore
        }
        const nextKey = activeRef.current === "a" ? "b" : "a";
        activeRef.current = nextKey;
        setActive(nextKey);
        requestAnimationFrame(() => setVeil(0));
        swappingRef.current = false;
      }, VEIL_IN_MS);
    }

    function onTimeUpdate(e: Event) {
      const el = e.currentTarget as HTMLVideoElement;
      if (swappingRef.current) return;
      if (el !== current()) return;
      const duration = el.duration;
      if (!Number.isFinite(duration) || duration <= SEAM_LEAD_SEC * 2) return;
      if (el.currentTime >= duration - SEAM_LEAD_SEC) {
        void swapAtSeam();
      }
    }

    function onEnded(e: Event) {
      const el = e.currentTarget as HTMLVideoElement;
      if (el !== current()) return;
      void swapAtSeam();
    }

    a.addEventListener("playing", onPlaying);
    a.addEventListener("canplay", onCanPlay);
    a.addEventListener("timeupdate", onTimeUpdate);
    b.addEventListener("timeupdate", onTimeUpdate);
    a.addEventListener("ended", onEnded);
    b.addEventListener("ended", onEnded);

    // Fallback if autoplay is blocked but poster/still is up.
    const readyFallback = window.setTimeout(() => {
      if (!poster) markReady();
    }, 1200);

    return () => {
      window.clearTimeout(readyFallback);
      a.removeEventListener("playing", onPlaying);
      a.removeEventListener("canplay", onCanPlay);
      a.removeEventListener("timeupdate", onTimeUpdate);
      b.removeEventListener("timeupdate", onTimeUpdate);
      a.removeEventListener("ended", onEnded);
      b.removeEventListener("ended", onEnded);
      a.pause();
      b.pause();
    };
  }, [src, poster, markReady]);

  return (
    <div className="absolute inset-0" aria-hidden>
      {poster ? (
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            backgroundImage: `url('${poster}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: FILTER,
            opacity: showPoster ? 1 : 0,
          }}
        />
      ) : null}
      <video
        ref={aRef}
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          filter: FILTER,
          opacity: !showPoster && active === "a" ? 1 : 0,
        }}
        src={src}
        poster={poster}
        muted
        playsInline
        preload="auto"
      />
      <video
        ref={bRef}
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          filter: FILTER,
          opacity: !showPoster && active === "b" ? 1 : 0,
        }}
        src={src}
        muted
        playsInline
        preload="auto"
      />
      <div
        className="absolute inset-0 transition-opacity ease-in-out"
        style={{
          // Soft black veil at the loop seam — not a solid brand wash.
          background: `radial-gradient(120% 90% at 50% 40%, ${veilColor}66, #000000aa)`,
          opacity: veil * 0.45,
          transitionDuration: `${VEIL_IN_MS}ms`,
        }}
      />
    </div>
  );
}
