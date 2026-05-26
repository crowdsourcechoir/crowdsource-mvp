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
  const fileCacheRef = useRef<File | null>(null);

  useEffect(() => {
    fileCacheRef.current = null;
  }, [clip.id]);

  async function ensureFile(): Promise<File> {
    if (fileCacheRef.current) return fileCacheRef.current;
    const file = await fetchClipFile(eventId, clip);
    fileCacheRef.current = file;
    return file;
  }

  return (
    <div
      draggable
      onDragStart={async (e) => {
        setDragging(true);
        try {
          const file = await ensureFile();
          e.dataTransfer.effectAllowed = "copy";
          e.dataTransfer.items.add(file);
        } catch {
          e.preventDefault();
        }
      }}
      onDragEnd={() => setDragging(false)}
      className={`group relative flex cursor-grab flex-col rounded-xl border bg-[#14141a] p-3 transition active:cursor-grabbing ${
        selected
          ? "border-[#CFFF81] ring-1 ring-[#CFFF81]/40"
          : "border-gray-700/70 hover:border-gray-500"
      } ${dragging ? "opacity-60" : ""} ${isNew ? "animate-pulse border-emerald-500/70" : ""}`}
      onClick={(e) => onSelectToggle(clip.id, e.shiftKey || e.metaKey || e.ctrlKey)}
    >
      {isNew && (
        <span className="absolute -right-2 -top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
          New
        </span>
      )}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {clip.label || clip.filename.replace(/\.[^.]+$/, "")}
          </p>
          <p className="truncate text-xs text-gray-500">
            {clip.contributorName || "Anonymous"} · {songgardenCategoryLabel(clip.category)}
            {clip.durationMs ? ` · ${formatDuration(clip.durationMs)}` : ""}
          </p>
        </div>
        <input
          type="checkbox"
          checked={selected}
          readOnly
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#CFFF81]"
          aria-label={`Select ${clip.label || clip.filename}`}
        />
      </div>
      <audio
        src={songgardenAudioUrl(eventId, clip.id)}
        controls
        preload="metadata"
        className="h-9 w-full"
        onPlay={onPlayed}
        onClick={(e) => e.stopPropagation()}
      />
      <p className="mt-2 text-[10px] uppercase tracking-wide text-gray-600 group-hover:text-gray-400">
        Drag to Ableton · Suno · Finder
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
