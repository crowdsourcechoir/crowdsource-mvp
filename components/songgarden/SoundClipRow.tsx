"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import type { Event } from "@/data/mockEvents";
import {
  fetchClipFile,
  songgardenAudioUrl,
  type SonggardenClip,
} from "@/data/songgardenClient";
import { enqueueClipFetch } from "@/lib/songgarden/clip-fetch-queue";
import { songgardenCategoryLabel } from "@/lib/songgarden/categories";
import { formatClipDuration, resolveClipSourcePrompt } from "@/lib/songgarden/clip-prompt";
import { wavFilename } from "@/lib/songgarden/sound-pack";
import ClipWaveform from "./ClipWaveform";

type SoundClipRowProps = {
  eventId: string;
  event: Event | null;
  clip: SonggardenClip;
  siblings: SonggardenClip[];
  activePadId?: string | null;
  onActivate?: (clipId: string | null) => void;
};

export default function SoundClipRow({
  eventId,
  event,
  clip,
  siblings,
  activePadId,
  onActivate,
}: SoundClipRowProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileCacheRef = useRef<File | null>(null);
  const streamUrl = songgardenAudioUrl(eventId, clip.id, clip.submittedAt);
  const [src, setSrc] = useState<string | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);

  const prompt = resolveClipSourcePrompt(clip, event, siblings);
  const padName = (clip.label?.trim() && clip.label.trim().length <= 14
    ? clip.label.trim()
    : songgardenCategoryLabel(clip.category)
  ).toUpperCase();
  const durationLabel = formatClipDuration(clip.durationMs, audioDuration);
  const trimLabel =
    clip.trimStatus === "trimmed"
      ? `Trimmed −${clip.trimLeadMs ?? 0}ms / −${clip.trimTrailMs ?? 0}ms`
      : clip.trimStatus === "skipped"
        ? "Silence kept"
        : null;

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fileCacheRef.current = null;
    setError(false);
    setLoading(true);
    setSrc(null);
    setArrayBuffer(null);
    setCurrentTime(0);

    void enqueueClipFetch(() => fetchClipFile(eventId, clip))
      .then(async (file) => {
        if (cancelled) return;
        fileCacheRef.current = file;
        objectUrl = URL.createObjectURL(file);
        setSrc(objectUrl);
        setError(false);
        const buf = await file.arrayBuffer();
        if (!cancelled) setArrayBuffer(buf);
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
      setPlaying(false);
    }
  }, [activePadId, clip.id, playing]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !playing) return;
    let raf = 0;
    const tick = () => {
      setCurrentTime(el.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  async function togglePlay() {
    if (error || !src) return;
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
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

  function handleSeek(timeSec: number) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = timeSec;
    setCurrentTime(timeSec);
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

  return (
    <div
      className={`rounded-xl border bg-[#121214] p-3 ${
        playing ? "border-[#CFFF81]/70" : "border-gray-800"
      } ${dragging ? "opacity-60" : ""} ${error ? "border-red-800/60" : ""}`}
    >
      {src ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onEnded={() => {
            setPlaying(false);
            setCurrentTime(0);
            onActivate?.(null);
          }}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={() => {
            setError(false);
            if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
              setAudioDuration(audioRef.current.duration);
            }
          }}
          onLoadedData={() => setError(false)}
          onCanPlay={() => setError(false)}
          onError={() => setError(true)}
        />
      ) : null}

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => void togglePlay()}
          disabled={error || !src}
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            playing
              ? "bg-[#CFFF81] text-black"
              : "border border-white/20 bg-white/5 text-gray-100 hover:border-white/40"
          } disabled:opacity-40`}
          aria-label={playing ? "Pause" : "Play"}
        >
          {loading && !playing ? "…" : error ? "!" : playing ? "❚❚" : "▶"}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">
            {padName}
            <span className="text-gray-600"> · {durationLabel}</span>
            <span className="text-gray-600"> · {songgardenCategoryLabel(clip.category)}</span>
            {trimLabel ? (
              <span className={clip.trimStatus === "trimmed" ? "text-[#CFFF81]/70" : "text-gray-600"}>
                {" "}
                · {trimLabel}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-sm leading-snug text-gray-100">{prompt}</p>
        </div>

        <button
          type="button"
          draggable
          onDragStart={handleDragStart}
          onDragEnd={() => setDragging(false)}
          title="Drag into Ableton / Finder"
          className="shrink-0 cursor-grab rounded-lg border border-dashed border-white/15 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-500 hover:border-[#CFFF81]/40 hover:text-[#CFFF81] active:cursor-grabbing"
        >
          Drag
        </button>
      </div>

      <div className="mt-2">
        <ClipWaveform
          arrayBuffer={arrayBuffer}
          currentTime={currentTime}
          duration={
            audioDuration && Number.isFinite(audioDuration)
              ? audioDuration
              : (clip.durationMs ?? 0) / 1000
          }
          playing={playing}
          onSeek={handleSeek}
        />
        <p className="mt-1 text-right font-mono text-[10px] tabular-nums text-gray-500">
          {formatClipDuration(currentTime * 1000)} / {durationLabel}
        </p>
      </div>
    </div>
  );
}
