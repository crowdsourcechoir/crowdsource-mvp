"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  fetchClipFile,
  songgardenAudioUrl,
  type SonggardenClip,
} from "@/data/songgardenClient";
import { enqueueClipFetch } from "@/lib/songgarden/clip-fetch-queue";
import { songgardenCategoryLabel } from "@/lib/songgarden/categories";
import { wavFilename } from "@/lib/songgarden/sound-pack";

type SoundPadTileProps = {
  eventId: string;
  clip: SonggardenClip;
  /** Stop this pad when another pad in the same grid starts. */
  activePadId?: string | null;
  onActivate?: (clipId: string | null) => void;
};

/**
 * Compact MIDI-pad style sound tile — click to play (lights up),
 * drag into Ableton / Finder / DAWs via DownloadURL.
 */
export default function SoundPadTile({
  eventId,
  clip,
  activePadId,
  onActivate,
}: SoundPadTileProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileCacheRef = useRef<File | null>(null);
  const streamUrl = songgardenAudioUrl(eventId, clip.id, clip.submittedAt);
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dragging, setDragging] = useState(false);

  const label = (clip.label?.trim() || clip.filename.replace(/\.[^.]+$/, "") || "Sound").trim();
  const category = songgardenCategoryLabel(clip.category);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fileCacheRef.current = null;
    setError(false);
    setLoading(true);
    setSrc(null);

    void enqueueClipFetch(() => fetchClipFile(eventId, clip))
      .then((file) => {
        if (cancelled) return;
        fileCacheRef.current = file;
        objectUrl = URL.createObjectURL(file);
        setSrc(objectUrl);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setSrc(streamUrl);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      audioRef.current?.pause();
    };
  }, [eventId, clip.id, clip.submittedAt, streamUrl]);

  useEffect(() => {
    if (activePadId != null && activePadId !== clip.id && playing) {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      setPlaying(false);
    }
  }, [activePadId, clip.id, playing]);

  async function togglePlay() {
    if (error || !src) return;
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      el.currentTime = 0;
      setPlaying(false);
      onActivate?.(null);
      return;
    }
    onActivate?.(clip.id);
    try {
      setLoading(true);
      await el.play();
      setPlaying(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function handleDragStart(e: DragEvent<HTMLButtonElement>) {
    setDragging(true);
    e.dataTransfer.effectAllowed = "copy";
    const name = wavFilename(clip);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const absoluteUrl = origin + streamUrl;
    e.dataTransfer.setData("DownloadURL", `audio/wav:${name}:${absoluteUrl}`);
    e.dataTransfer.setData("text/uri-list", absoluteUrl);
    e.dataTransfer.setData("text/plain", name);

    const cached = fileCacheRef.current;
    if (cached) {
      try {
        const wavFile =
          cached.name === name ? cached : new File([cached], name, { type: "audio/wav" });
        e.dataTransfer.items.add(wavFile);
      } catch {
        // DownloadURL still works for native DAWs.
      }
    }
  }

  const lit = playing;

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => setDragging(false)}
      onClick={() => void togglePlay()}
      title={`${label} · ${category} — click to play, drag into Ableton / Finder`}
      aria-pressed={playing}
      className={`group relative aspect-square w-full cursor-grab touch-manipulation overflow-hidden rounded-md border text-left transition active:cursor-grabbing active:scale-[0.97] ${
        lit
          ? "border-[#CFFF81] bg-[#CFFF81] text-black shadow-[0_0_18px_rgba(207,255,129,0.35)]"
          : "border-white/15 bg-gradient-to-br from-[#2a2a30] to-[#16161a] text-gray-200 hover:border-white/35 hover:from-[#32323a]"
      } ${dragging ? "opacity-50" : ""} ${error ? "border-red-800/60" : ""}`}
    >
      {src ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onEnded={() => {
            setPlaying(false);
            onActivate?.(null);
          }}
          onPause={() => setPlaying(false)}
          onLoadedData={() => setError(false)}
          onCanPlay={() => setError(false)}
          onError={() => setError(true)}
        />
      ) : null}

      <span
        className={`pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b ${
          lit ? "from-white/35 to-transparent" : "from-white/10 to-transparent"
        }`}
        aria-hidden
      />

      <span className="relative flex h-full flex-col justify-between p-2">
        <span
          className={`text-[9px] font-medium uppercase tracking-wider ${
            lit ? "text-black/55" : "text-gray-500"
          }`}
        >
          {category}
        </span>
        <span
          className={`line-clamp-3 text-[11px] font-semibold leading-tight ${
            lit ? "text-black" : "text-gray-100"
          }`}
        >
          {loading && !playing ? "…" : error ? "Error" : label}
        </span>
      </span>
    </button>
  );
}
