"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { peaksFromAudioBuffer } from "@/lib/songgarden/waveform-peaks";

type ClipWaveformProps = {
  /** Decoded from the same file used for playback. */
  arrayBuffer: ArrayBuffer | null;
  currentTime: number;
  duration: number;
  playing: boolean;
  onSeek: (timeSec: number) => void;
  accent?: string;
};

export default function ClipWaveform({
  arrayBuffer,
  currentTime,
  duration,
  playing,
  onSeek,
  accent = "#CFFF81",
}: ClipWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!arrayBuffer) {
      setPeaks([]);
      return;
    }
    let cancelled = false;
    const bars = Math.max(80, Math.min(280, Math.floor((wrapRef.current?.clientWidth ?? 480) / 3)));
    void peaksFromAudioBuffer(arrayBuffer, bars)
      .then((result) => {
        if (!cancelled) setPeaks(result.peaks);
      })
      .catch(() => {
        if (!cancelled) setPeaks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [arrayBuffer]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, wrap.clientWidth);
    const h = 56;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
    const bars = peaks.length || 64;
    const gap = 1;
    const barW = Math.max(1.5, (w - gap * (bars - 1)) / bars);
    const mid = h / 2;

    for (let i = 0; i < bars; i += 1) {
      const amp = peaks[i] ?? 0.08;
      const bh = Math.max(2, amp * (h - 8));
      const x = i * (barW + gap);
      const played = i / bars <= progress;
      ctx.fillStyle = played ? accent : "rgba(255,255,255,0.22)";
      ctx.fillRect(x, mid - bh / 2, barW, bh);
    }

    const playX = progress * w;
    ctx.fillStyle = playing ? accent : "rgba(255,255,255,0.7)";
    ctx.fillRect(playX - 0.75, 0, 1.5, h);
  }, [accent, currentTime, duration, peaks, playing]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  function timeFromPointer(clientX: number): number {
    const wrap = wrapRef.current;
    if (!wrap || duration <= 0) return 0;
    const rect = wrap.getBoundingClientRect();
    const t = (clientX - rect.left) / rect.width;
    return Math.min(duration, Math.max(0, t * duration));
  }

  return (
    <div
      ref={wrapRef}
      className="relative w-full cursor-ew-resize touch-none select-none"
      role="slider"
      aria-label="Scrub clip"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      onPointerDown={(e) => {
        draggingRef.current = true;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        onSeek(timeFromPointer(e.clientX));
      }}
      onPointerMove={(e) => {
        if (!draggingRef.current) return;
        onSeek(timeFromPointer(e.clientX));
      }}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
    >
      <canvas ref={canvasRef} className="block w-full rounded-md bg-black/40" />
      {peaks.length === 0 && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-gray-500">
          Loading waveform…
        </p>
      )}
    </div>
  );
}
