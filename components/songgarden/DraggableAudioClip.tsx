"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchClipFile,
  songgardenAudioUrl,
  type SonggardenClip,
} from "@/data/songgardenClient";
import { songgardenCategoryLabel } from "@/lib/songgarden/categories";
import { wavFilename } from "@/lib/songgarden/sound-pack";

type DraggableAudioClipProps = {
  eventId: string;
  clip: SonggardenClip;
  selected: boolean;
  isNew?: boolean;
  onSelectToggle: (clipId: string, multi: boolean) => void;
  onPlayed?: () => void;
};

function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "";
  const s = Math.round(ms / 1000);
  return `${s}s`;
}

export { wavFilename };

export default function DraggableAudioClip({
  eventId,
  clip,
  selected,
  isNew,
  onSelectToggle,
  onPlayed,
}: DraggableAudioClipProps) {
  const [dragging, setDragging] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(true);
  const fileCacheRef = useRef<File | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    fileCacheRef.current = null;
    setAudioError(false);
    setAudioLoading(true);
    setAudioSrc(null);

    void fetchClipFile(eventId, clip)
      .then((file) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        fileCacheRef.current = file;
        setAudioSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setAudioError(true);
      })
      .finally(() => {
        if (!cancelled) setAudioLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [eventId, clip.id, clip.submittedAt]);

  async function ensureFile(): Promise<File> {
    if (fileCacheRef.current) return fileCacheRef.current;
    const file = await fetchClipFile(eventId, clip);
    fileCacheRef.current = file;
    return file;
  }

  function handleCardDragStart(e: React.DragEvent<HTMLDivElement>) {
    setDragging(true);
    e.dataTransfer.effectAllowed = "copy";

    const name = wavFilename(clip);

    // Native apps (Ableton, Finder, etc.) only accept the DownloadURL format,
    // which points at an absolute URL the OS downloads as a real .wav file.
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const absoluteUrl = origin + songgardenAudioUrl(eventId, clip.id, clip.submittedAt);
    e.dataTransfer.setData("DownloadURL", `audio/wav:${name}:${absoluteUrl}`);
    e.dataTransfer.setData("text/uri-list", absoluteUrl);

    // Browser drop targets: attach the already-fetched File when available.
    const cached = fileCacheRef.current;
    if (cached) {
      try {
        const wavFile =
          cached.name === name
            ? cached
            : new File([cached], name, { type: "audio/wav" });
        e.dataTransfer.items.add(wavFile);
      } catch {
        // items.add can throw in some browsers; DownloadURL still works.
      }
    }
  }

  return (
    <div
      draggable
      onDragStart={handleCardDragStart}
      onDragEnd={() => setDragging(false)}
      title="Drag into Ableton, Suno, or Finder"
      className={`group relative flex cursor-grab flex-col rounded-xl border bg-[#14141a] p-3 transition active:cursor-grabbing ${
        selected
          ? "border-[#CFFF81] ring-1 ring-[#CFFF81]/40"
          : "border-gray-700/70 hover:border-gray-500"
      } ${dragging ? "opacity-60" : ""} ${isNew ? "animate-pulse border-emerald-500/70" : ""}`}
    >
      {isNew && (
        <span className="absolute -right-2 -top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
          New
        </span>
      )}
      <div
        className="mb-2 flex cursor-pointer items-start justify-between gap-2"
        onClick={(e) => onSelectToggle(clip.id, e.shiftKey || e.metaKey || e.ctrlKey)}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {clip.label || clip.filename.replace(/\.[^.]+$/, "")}
          </p>
          <p className="truncate text-xs text-gray-500">
            {clip.contributorName || "Anonymous"} · {songgardenCategoryLabel(clip.category)}
            {clip.durationMs ? ` · ${formatDuration(clip.durationMs)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <input
            type="checkbox"
            checked={selected}
            readOnly
            className="mt-0.5 h-4 w-4 accent-[#CFFF81]"
            aria-label={`Select ${clip.label || clip.filename}`}
          />
        </div>
      </div>
      {audioError ? (
        <p className="rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          Could not load audio for this clip.
        </p>
      ) : audioLoading || !audioSrc ? (
        <div className="flex h-9 items-center rounded-lg border border-gray-700/70 bg-black/20 px-3 text-xs text-gray-500">
          Loading preview…
        </div>
      ) : (
        <audio
          src={audioSrc}
          controls
          preload="metadata"
          draggable={false}
          onDragStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="h-9 w-full"
          onPlay={onPlayed}
          onError={() => setAudioError(true)}
        />
      )}
      <p className="mt-2 text-[10px] uppercase tracking-wide text-gray-600 group-hover:text-gray-400">
        Drag this card into your DAW · use player to preview
      </p>
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
    const source = await fetchClipFile(eventId, clip);
    const name = wavFilename(clip);
    const file =
      source.name === name ? source : new File([source], name, { type: "audio/wav" });
    dataTransfer.items.add(file);
  }
}
