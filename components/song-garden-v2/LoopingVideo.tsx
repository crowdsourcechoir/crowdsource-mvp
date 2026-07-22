"use client";

import { useEffect, useRef, useState } from "react";

type LoopingVideoProps = {
  src: string;
  poster?: string;
  opacity: number;
  /** Seconds of overlap at the seam so the hard cut isn't visible. */
  crossfadeSeconds?: number;
};

/**
 * Background loop without a hard reset flash. Two copies of the same clip trade
 * off in the last ~1s — the outgoing one fades out while the incoming one starts
 * from 0 — so a short AI clip doesn't read as a glitchy jump every few seconds.
 */
export default function LoopingVideo({
  src,
  poster,
  opacity,
  crossfadeSeconds = 1.15,
}: LoopingVideoProps) {
  const primaryRef = useRef<HTMLVideoElement | null>(null);
  const secondaryRef = useRef<HTMLVideoElement | null>(null);
  /** 0 = primary fully visible, 1 = secondary fully visible. */
  const [mix, setMix] = useState(0);
  const primaryIsLead = useRef(true);
  const fading = useRef(false);

  useEffect(() => {
    const primary = primaryRef.current;
    const secondary = secondaryRef.current;
    if (!primary || !secondary) return;

    for (const el of [primary, secondary]) {
      el.muted = true;
      el.playsInline = true;
      el.loop = false;
      el.preload = "auto";
    }

    primaryIsLead.current = true;
    fading.current = false;
    setMix(0);
    primary.currentTime = 0;
    void primary.play().catch(() => undefined);

    function lead(): HTMLVideoElement {
      return primaryIsLead.current ? primary! : secondary!;
    }
    function trail(): HTMLVideoElement {
      return primaryIsLead.current ? secondary! : primary!;
    }

    function tick() {
      const current = lead();
      const next = trail();
      const duration = current.duration;
      if (!Number.isFinite(duration) || duration <= crossfadeSeconds * 2) return;

      const remaining = duration - current.currentTime;
      if (remaining <= crossfadeSeconds) {
        if (!fading.current) {
          fading.current = true;
          next.currentTime = 0;
          void next.play().catch(() => undefined);
        }
        const t = Math.max(0, Math.min(1, 1 - remaining / crossfadeSeconds));
        setMix(primaryIsLead.current ? t : 1 - t);

        if (remaining <= 0.04 || current.ended) {
          current.pause();
          current.currentTime = 0;
          primaryIsLead.current = !primaryIsLead.current;
          fading.current = false;
          setMix(primaryIsLead.current ? 0 : 1);
        }
      }
    }

    primary.addEventListener("timeupdate", tick);
    secondary.addEventListener("timeupdate", tick);
    primary.addEventListener("ended", tick);
    secondary.addEventListener("ended", tick);

    return () => {
      primary.removeEventListener("timeupdate", tick);
      secondary.removeEventListener("timeupdate", tick);
      primary.removeEventListener("ended", tick);
      secondary.removeEventListener("ended", tick);
    };
  }, [src, crossfadeSeconds]);

  return (
    <div className="absolute inset-0" style={{ opacity }} aria-hidden>
      <video
        ref={primaryRef}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: 1 - mix, filter: "saturate(1.05)" }}
        src={src}
        poster={poster}
        muted
        playsInline
      />
      <video
        ref={secondaryRef}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: mix, filter: "saturate(1.05)" }}
        src={src}
        muted
        playsInline
      />
    </div>
  );
}
