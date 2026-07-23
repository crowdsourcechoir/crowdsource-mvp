"use client";

import { useEffect, useRef } from "react";

type LoopingVideoProps = {
  src: string;
  poster?: string;
};

/**
 * Single-layer background loop. Avoids dual-video opacity crossfades — those
 * stacked two copies of the same AI clip and made objects (trees, etc.) ghost
 * over themselves at the seam.
 */
export default function LoopingVideo({ src, poster }: LoopingVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    el.playsInline = true;
    el.loop = true;
    el.preload = "auto";
    el.currentTime = 0;
    void el.play().catch(() => undefined);
  }, [src]);

  return (
    <div className="absolute inset-0" aria-hidden>
      <video
        ref={ref}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: "saturate(1.12) brightness(1.12) contrast(1.04)" }}
        src={src}
        poster={poster}
        muted
        playsInline
        loop
      />
    </div>
  );
}
