"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  fetchClipFile,
  songgardenAudioUrl,
  type SonggardenClip,
} from "@/data/songgardenClient";
import { enqueueClipFetch } from "@/lib/songgarden/clip-fetch-queue";
import { songgardenCategoryLabel } from "@/lib/songgarden/categories";
import { formatClipDuration } from "@/lib/songgarden/clip-prompt";
import { wavFilename } from "@/lib/songgarden/sound-pack";
import ClipWaveform from "./ClipWaveform";

type DraggableAudioClipProps = {
  eventId: string;
  clip: SonggardenClip;
  selected: boolean;
  isNew?: boolean;
  onSelectToggle: (clipId: string, multi: boolean) => void;
  onPlayed?: () => void;
  onOpenDetail?: (clip: SonggardenClip) => void;
};

export { wavFilename };

export default function DraggableAudioClip({
  eventId,
  clip,
  selected,
  isNew,
  onSelectToggle,
  onPlayed,
  onOpenDetail,
}: DraggableAudioClipProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileCacheRef = useRef<File | null>(null);
  const streamUrl = songgardenAudioUrl(eventId, clip.id, clip.submittedAt);
  /** Object URL once fetched — avoid pointing every <audio> at streamUrl up front (N× stampede). */
  const [src, setSrc] = useState<string | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);

  const padName = (
    clip.label?.trim() && clip.label.trim().length <= 14
      ? clip.label.trim()
      : songgardenCategoryLabel(clip.category)
  ).toUpperCase();
  const durationLabel = formatClipDuration(clip.durationMs, audioDuration);
  const title =
    clip.label?.trim() ||
    clip.filename.replace(/\.[^.]+$/, "") ||
    songgardenCategoryLabel(clip.category);
  const trimLabel =
    clip.trimStatus === "trimmed"
      ? `Trimmed −${clip.trimLeadMs ?? 0}ms / −${clip.trimTrailMs ?? 0}ms`
      : clip.trimStatus === "skipped"
        ? "Silence kept"
        : clip.hasOriginal
          ? "Original kept"
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
    setPlaying(false);

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
      .catch(async () => {
        if (cancelled) return;
        // Last resort after queued fetch fails — stream for playback, still try bytes for waveform.
        setSrc(streamUrl);
        try {
          const res = await fetch(streamUrl, { cache: "no-store" });
          if (!res.ok || cancelled) return;
          const buf = await res.arrayBuffer();
          if (!cancelled) setArrayBuffer(buf);
        } catch {
          // Playback may still work via <audio src={streamUrl}>.
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      audioRef.current?.pause();
    };
  }, [eventId, clip.id, clip.submittedAt, clip.trimStatus, streamUrl]);

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
      return;
    }
    try {
      setLoading(true);
      await el.play();
      setPlaying(true);
      onPlayed?.();
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
      className={`relative rounded-xl border bg-[#121214] p-3 ${
        playing || selected
          ? "border-[#CFFF81]/70"
          : "border-gray-800"
      } ${dragging ? "opacity-60" : ""} ${error ? "border-red-800/60" : ""} ${
        isNew ? "animate-pulse" : ""
      }`}
    >
      {isNew && (
        <span className="absolute -right-2 -top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
          New
        </span>
      )}

      {src ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onEnded={() => {
            setPlaying(false);
            setCurrentTime(0);
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

      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => void togglePlay()}
          disabled={error || !src}
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            playing
              ? "bg-[#CFFF81] text-black"
              : "border border-white/20 bg-white/5 text-gray-100 hover:border-white/40"
          } disabled:opacity-40`}
          aria-label={playing ? "Pause" : "Play"}
        >
          {loading && !playing ? "…" : error ? "!" : playing ? "❚❚" : "▶"}
        </button>

        <button
          type="button"
          className="min-w-0 flex-1 cursor-pointer text-left"
          onClick={(e) => onSelectToggle(clip.id, e.shiftKey || e.metaKey || e.ctrlKey)}
        >
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">
            {padName}
            <span className="text-gray-600"> · {durationLabel}</span>
            <span className="text-gray-600"> · {songgardenCategoryLabel(clip.category)}</span>
            {trimLabel ? (
              <span className={clip.trimStatus === "trimmed" ? "text-[#CFFF81]/70" : "text-gray-600"}>
                {" "}
                · {trimLabel}
              </span>
            ) : null}
            {clip.contributorName ? (
              <span className="text-gray-600"> · {clip.contributorName}</span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold uppercase tracking-wide leading-snug text-gray-100">
            {title}
          </p>
        </button>

        <div className="flex shrink-0 flex-wrap items-start justify-end gap-1">
          <input
            type="checkbox"
            checked={selected}
            readOnly
            onClick={(e) => {
              e.stopPropagation();
              onSelectToggle(clip.id, true);
            }}
            className="mt-1 h-4 w-4 accent-[#CFFF81]"
            aria-label={`Select ${title}`}
          />
          <button
            type="button"
            draggable
            onDragStart={handleDragStart}
            onDragEnd={() => setDragging(false)}
            title="Drag into Ableton / Finder"
            className="cursor-grab rounded-lg border border-dashed border-white/15 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-500 hover:border-[#CFFF81]/40 hover:text-[#CFFF81] active:cursor-grabbing"
          >
            Drag
          </button>
          {onOpenDetail ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail(clip);
              }}
              className="rounded-lg border border-gray-700 px-2 py-1 text-[10px] uppercase tracking-wide text-[#CFFF81] hover:border-[#CFFF81]/40"
            >
              Edit
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-2">
        {error ? (
          <p className="rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            Could not load audio for this clip.
          </p>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

export async function dragClipsToDesktop(
  eventId: string,
  clips: SonggardenClip[],
  dataTransfer: DataTransfer
): Promise<void> {
  dataTransfer.effectAllowed = "copy";
  for (const clip of clips) {
    const source = await enqueueClipFetch(() => fetchClipFile(eventId, clip));
    const name = wavFilename(clip);
    const file =
      source.name === name ? source : new File([source], name, { type: "audio/wav" });
    dataTransfer.items.add(file);
  }
}
