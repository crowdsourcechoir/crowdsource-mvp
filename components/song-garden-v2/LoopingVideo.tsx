"use client";

import { useEffect, useRef, useState } from "react";

type LoopingVideoProps = {
  src: string;
  poster?: string;
  /** Soft seam veil color — world primary, not a scene still (avoids double-image ghosts). */
  veilColor?: string;
};

const SEAM_LEAD_SEC = 0.7;
const VEIL_IN_MS = 320;
const FILTER = "saturate(1.12) brightness(1.12) contrast(1.04)";

/**
 * Dual-buffer loop with a short primary-color veil at the seam. Swap happens
 * under the veil so end-frame and start-frame never composite into a ghost.
 */
export default function LoopingVideo({ src, poster, veilColor = "#0E1F24" }: LoopingVideoProps) {
  const aRef = useRef<HTMLVideoElement | null>(null);
  const bRef = useRef<HTMLVideoElement | null>(null);
  const activeRef = useRef<"a" | "b">("a");
  const swappingRef = useRef(false);
  const [active, setActive] = useState<"a" | "b">("a");
  const [veil, setVeil] = useState(0);

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
        // Reveal the new buffer after the veil is fully covering.
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

    a.addEventListener("timeupdate", onTimeUpdate);
    b.addEventListener("timeupdate", onTimeUpdate);
    a.addEventListener("ended", onEnded);
    b.addEventListener("ended", onEnded);

    return () => {
      a.removeEventListener("timeupdate", onTimeUpdate);
      b.removeEventListener("timeupdate", onTimeUpdate);
      a.removeEventListener("ended", onEnded);
      b.removeEventListener("ended", onEnded);
      a.pause();
      b.pause();
    };
  }, [src]);

  return (
    <div className="absolute inset-0" aria-hidden>
      <video
        ref={aRef}
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          filter: FILTER,
          opacity: active === "a" ? 1 : 0,
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
          opacity: active === "b" ? 1 : 0,
        }}
        src={src}
        muted
        playsInline
        preload="auto"
      />
      <div
        className="absolute inset-0 transition-opacity ease-in-out"
        style={{
          background: `radial-gradient(120% 90% at 50% 40%, ${veilColor}b8, ${veilColor})`,
          opacity: veil,
          transitionDuration: `${VEIL_IN_MS}ms`,
        }}
      />
    </div>
  );
}
