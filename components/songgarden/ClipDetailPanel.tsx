"use client";

import { useEffect, useState } from "react";
import {
  deleteSonggardenClip,
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
  onDeleted: (clipId: string) => void;
};

/**
 * Inspect a clip: play trimmed (pad-ready) vs original, restore original as playable, delete.
 */
export default function ClipDetailPanel({
  eventId,
  clip,
  onClose,
  onUpdated,
  onDeleted,
}: ClipDetailPanelProps) {
  const [mode, setMode] = useState<"playable" | "original">("playable");
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragHint, setDragHint] = useState<string | null>(null);

  const playableUrl = songgardenAudioUrl(eventId, clip.id, clip.submittedAt);
  const originalUrl = songgardenAudioUrl(eventId, clip.id, clip.submittedAt, { original: true });
  const activeUrl = mode === "original" && clip.hasOriginal ? originalUrl : playableUrl;

  useEffect(() => {
    setMode("playable");
    setError(null);
  }, [clip.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  async function handleDelete() {
    const name = clip.label || clip.filename || "this sound";
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteSonggardenClip(eventId, clip.id);
      onDeleted(clip.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete sound.");
      setDeleting(false);
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

  const modeIdle =
    "rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-[var(--csc-accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40";
  const modeActive =
    "rounded-lg border border-[var(--csc-accent)] bg-[var(--csc-accent)] px-3 py-1.5 text-xs font-medium text-black";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close overlay"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Clip detail"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/15 bg-black p-5 shadow-2xl shadow-black/50"
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
            className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-gray-300 transition-colors hover:border-[var(--csc-accent)] hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("playable")}
            className={mode === "playable" ? modeActive : modeIdle}
          >
            Playable (trimmed)
          </button>
          <button
            type="button"
            disabled={!clip.hasOriginal}
            onClick={() => setMode("original")}
            className={mode === "original" ? modeActive : modeIdle}
          >
            Original{clip.hasOriginal ? "" : " (none)"}
          </button>
        </div>

        <audio
          key={activeUrl}
          src={activeUrl}
          controls
          className="mt-4 h-10 w-full"
          onError={() => setError("Could not load audio for this clip.")}
          onLoadedData={() => setError(null)}
        />

        <div
          draggable
          onDragStart={(e) => void handleDragStart(e)}
          onDragEnd={() => setDragHint(null)}
          className="mt-4 cursor-grab rounded-lg border border-dashed border-[var(--csc-accent)]/40 bg-[var(--csc-accent)]/5 px-4 py-3 text-sm text-[var(--csc-accent)] active:cursor-grabbing"
        >
          Drag {mode === "original" && clip.hasOriginal ? "original" : "trimmed"} into Ableton /
          Finder
          {dragHint ? ` · ${dragHint}` : ""}
        </div>

        {clip.hasOriginal && (
          <button
            type="button"
            disabled={restoring || deleting}
            onClick={() => void handleRestore()}
            className="mt-4 w-full rounded-lg border border-white/15 px-3 py-2 text-sm text-gray-200 transition-colors hover:border-[var(--csc-accent)] hover:text-white disabled:opacity-50"
          >
            {restoring ? "Restoring…" : "Use original as playable (undo trim)"}
          </button>
        )}

        <button
          type="button"
          disabled={deleting || restoring}
          onClick={() => void handleDelete()}
          className="mt-3 w-full rounded-lg border border-red-500/50 px-3 py-2 text-sm text-red-200 transition-colors hover:border-red-400 hover:text-red-100 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete sound"}
        </button>

        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  );
}
