"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchClipFile,
  songgardenAudioUrl,
  type SonggardenClip,
} from "@/data/songgardenClient";
import { songgardenCategoryLabel } from "@/lib/songgarden/categories";

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
  const fileCacheRef = useRef<File | null>(null);

  useEffect(() => {
    fileCacheRef.current = null;
    setAudioError(false);
  }, [clip.id]);

  async function ensureFile(): Promise<File> {
    if (fileCacheRef.current) return fileCacheRef.current;
    const file = await fetchClipFile(eventId, clip);
    fileCacheRef.current = file;
    return file;
  }

  async function startDrag(dataTransfer: DataTransfer) {
    const file = await ensureFile();
    dataTransfer.effectAllowed = "copy";
    dataTransfer.items.add(file);
  }

  return (
    <div
      className={`group relative flex flex-col rounded-xl border bg-[#14141a] p-3 transition ${
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
          <button
            type="button"
            draggable
            title="Drag to Ableton, Suno, or Finder"
            aria-label={`Drag ${clip.label || clip.filename} to your DAW`}
            onClick={(e) => e.stopPropagation()}
            onDragStart={async (e) => {
              setDragging(true);
              try {
                await startDrag(e.dataTransfer);
              } catch {
                e.preventDefault();
              }
            }}
            onDragEnd={() => setDragging(false)}
            className="cursor-grab rounded-md border border-gray-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 hover:border-[#CFFF81]/50 hover:text-[#CFFF81] active:cursor-grabbing"
          >
            Drag
          </button>
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
      ) : (
        <audio
          src={songgardenAudioUrl(eventId, clip.id)}
          controls
          preload="metadata"
          className="h-9 w-full"
          onPlay={onPlayed}
          onError={() => setAudioError(true)}
        />
      )}
      <p className="mt-2 text-[10px] uppercase tracking-wide text-gray-600 group-hover:text-gray-400">
        Use player to preview · drag handle to export
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
    const file = await fetchClipFile(eventId, clip);
    dataTransfer.items.add(file);
  }
}
