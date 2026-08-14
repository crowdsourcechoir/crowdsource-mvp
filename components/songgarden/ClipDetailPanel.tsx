"use client";

import { useEffect, useState } from "react";
import {
  fetchClipFile,
  restoreSonggardenOriginal,
  songgardenAudioUrl,
  type SonggardenClip,
} from "@/data/songgardenClient";
import { songgardenCategoryLabel } from "@/lib/songgarden/categories";
import { wavFilename } from "@/lib/songgarden/sound-pack";

type ClipDetailPanelProps = {
  eventId: string;
  clip: SonggardenClip;
  onClose: () => void;
  onUpdated: (clip: SonggardenClip) => void;
};

/**
 * Inspect a clip: play trimmed (pad-ready) vs original, restore original as playable.
 */
export default function ClipDetailPanel({
  eventId,
  clip,
  onClose,
  onUpdated,
}: ClipDetailPanelProps) {
  const [mode, setMode] = useState<"playable" | "original">("playable");
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragHint, setDragHint] = useState<string | null>(null);

  const playableUrl = songgardenAudioUrl(eventId, clip.id, clip.submittedAt);
  const originalUrl = songgardenAudioUrl(eventId, clip.id, clip.submittedAt, { original: true });
  const activeUrl = mode === "original" && clip.hasOriginal ? originalUrl : playableUrl;

  useEffect(() => {
    setMode("playable");
    setError(null);
  }, [clip.id]);

  async function handleRestore() {
    if (!clip.hasOriginal) return;
    if (
      !window.confirm(
        "Replace the playable (trimmed) version with the original untrimmed audio? You can still keep the original on file."
      )
    ) {
      return;
    }
    setRestoring(true);
    setError(null);
    try {
      const updated = await restoreSonggardenOriginal(eventId, clip.id);
      onUpdated(updated);
      setMode("playable");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore original.");
    } finally {
      setRestoring(false);
    }
  }

  async function handleDragStart(e: React.DragEvent) {
    const useOriginal = mode === "original" && clip.hasOriginal;
    const name = useOriginal
      ? wavFilename(clip).replace(/\.wav$/i, ".original.wav")
      : wavFilename(clip);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const absoluteUrl = origin + (useOriginal ? originalUrl : playableUrl);
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("DownloadURL", `audio/wav:${name}:${absoluteUrl}`);
    e.dataTransfer.setData("text/uri-list", absoluteUrl);
    try {
      const file = await fetchClipFile(eventId, clip, { original: useOriginal });
      const wavFile = file.name === name ? file : new File([file], name, { type: "audio/wav" });
      e.dataTransfer.items.add(wavFile);
    } catch {
      // DownloadURL still works.
    }
    setDragHint(useOriginal ? "Dragging original…" : "Dragging trimmed…");
  }

  const trimLabel =
    clip.trimStatus === "trimmed"
      ? `Trimmed −${clip.trimLeadMs ?? 0}ms lead / −${clip.trimTrailMs ?? 0}ms trail`
      : clip.trimStatus === "skipped"
        ? "Trim skipped (no clear silence)"
        : "Legacy clip (not auto-trimmed)";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Clip detail"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-700 bg-[#121214] p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-white">
              {clip.label || clip.filename}
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              {clip.contributorName || "Anonymous"} · {songgardenCategoryLabel(clip.category)}
              {clip.durationMs != null ? ` · ${Math.round(clip.durationMs / 1000)}s` : ""}
            </p>
            <p className="mt-1 text-xs text-gray-500">{trimLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-600 px-2 py-1 text-sm text-gray-300 hover:bg-gray-800"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("playable")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              mode === "playable"
                ? "bg-[#CFFF81] text-[#1a1530]"
                : "border border-gray-600 text-gray-300 hover:bg-gray-800"
            }`}
          >
            Playable (trimmed)
          </button>
          <button
            type="button"
            disabled={!clip.hasOriginal}
            onClick={() => setMode("original")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
              mode === "original"
                ? "bg-[#CFFF81] text-[#1a1530]"
                : "border border-gray-600 text-gray-300 hover:bg-gray-800"
            }`}
          >
            Original{clip.hasOriginal ? "" : " (none)"}
          </button>
        </div>

        <audio key={activeUrl} src={activeUrl} controls className="mt-4 h-10 w-full" />

        <div
          draggable
          onDragStart={(e) => void handleDragStart(e)}
          onDragEnd={() => setDragHint(null)}
          className="mt-4 cursor-grab rounded-xl border border-dashed border-[#CFFF81]/40 bg-[#CFFF81]/5 px-4 py-3 text-sm text-[#CFFF81] active:cursor-grabbing"
        >
          Drag {mode === "original" && clip.hasOriginal ? "original" : "trimmed"} into Ableton /
          Finder
          {dragHint ? ` · ${dragHint}` : ""}
        </div>

        {clip.hasOriginal && (
          <button
            type="button"
            disabled={restoring}
            onClick={() => void handleRestore()}
            className="mt-4 w-full rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-200 hover:bg-amber-950/50 disabled:opacity-50"
          >
            {restoring ? "Restoring…" : "Use original as playable (undo trim)"}
          </button>
        )}

        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
      </div>
    </div>
  );
}
