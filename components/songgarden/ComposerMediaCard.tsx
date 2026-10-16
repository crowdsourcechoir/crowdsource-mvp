"use client";

import { useRef, useState, type DragEvent } from "react";
import ContributionActionsMenu from "@/components/songgarden/ContributionActionsMenu";
import { isPhotoMediaUrl, mediaDragMeta } from "@/lib/composer/media-drag";

type Props = {
  url: string;
  participantName: string;
  caption?: string | null;
  selected?: boolean;
  onSelectToggle?: (multi: boolean) => void;
  onDelete?: () => Promise<void>;
};

/** Composer video/photo card: drag the file out, and delete with a confirmed menu. */
export default function ComposerMediaCard({
  url,
  participantName,
  caption,
  selected = false,
  onSelectToggle,
  onDelete,
}: Props) {
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileCacheRef = useRef<File | null>(null);
  const photo = isPhotoMediaUrl(url);
  const meta = mediaDragMeta(url, participantName);

  async function cachedFile(): Promise<File | null> {
    if (fileCacheRef.current) return fileCacheRef.current;
    if (!url.trim()) return null;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size === 0) return null;
    const file = new File([blob], meta.filename, { type: meta.mime || blob.type });
    fileCacheRef.current = file;
    return file;
  }

  async function togglePlay() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      try {
        await el.play();
      } catch {
        setPlaying(false);
      }
      return;
    }
    el.pause();
  }

  function toggleSound() {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }

  async function togglePictureInPicture() {
    const el = videoRef.current;
    if (!el || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement === el) {
        await document.exitPictureInPicture();
        return;
      }
      await el.requestPictureInPicture();
    } catch {
      // Browser blocked picture-in-picture for this clip.
    }
  }

  async function handleDragStart(e: DragEvent<HTMLButtonElement>) {
    setDragging(true);
    e.dataTransfer.effectAllowed = "copy";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const absoluteUrl = url.startsWith("http") ? url : `${origin}${url}`;
    e.dataTransfer.setData("DownloadURL", `${meta.mime}:${meta.filename}:${absoluteUrl}`);
    e.dataTransfer.setData("text/uri-list", absoluteUrl);
    e.dataTransfer.setData("text/plain", meta.filename);
    try {
      const file = await cachedFile();
      if (file) e.dataTransfer.items.add(file);
    } catch {
      // DownloadURL still lets native apps pull the file.
    }
  }

  return (
    <figure
      className={`relative mx-auto w-full max-w-[280px] overflow-hidden rounded-[1.25rem] border bg-black/30 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10 ${
        selected || dragging
          ? "border-[var(--csc-accent)]/70 opacity-100"
          : "border-white/10"
      } ${dragging ? "opacity-60" : ""}`}
    >
      <div className="relative">
      {!url.trim() || failed ? (
        <p className="flex aspect-[9/16] items-center justify-center border border-red-800/40 bg-red-950/30 px-3 text-center text-xs text-red-300">
          Could not load {photo ? "photo" : "video"} for this response.
        </p>
      ) : photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- contributor upload URL
        <img
          src={url}
          alt=""
          draggable={false}
          className="aspect-[9/16] w-full bg-black object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <video
          ref={videoRef}
          src={url}
          playsInline
          preload="metadata"
          className="aspect-[9/16] w-full bg-black object-cover"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setFailed(true)}
        />
      )}
      {url.trim() && !failed ? (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-end gap-1 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-8">
          {photo ? null : (
            <div className="mr-auto flex items-center gap-1">
              <button
                type="button"
                className="csc-btn-circle bg-black text-xs text-white"
                aria-label={playing ? "Pause" : "Play"}
                onClick={() => void togglePlay()}
              >
                {playing ? "❚❚" : "▶"}
              </button>
              <button
                type="button"
                className="csc-btn-circle bg-black text-white"
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={toggleSound}
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden fill="currentColor">
                  {muted ? (
                    <path d="M4 9v6h4l5 4V5L8 9H4zm13.5 3 2.2-2.2-1.4-1.4L16 10.6l-2.3-2.2-1.4 1.4L14.6 12l-2.3 2.2 1.4 1.4L16 13.4l2.3 2.2 1.4-1.4L17.5 12z" />
                  ) : (
                    <path d="M4 9v6h4l5 4V5L8 9H4zm11.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 15.5 12z" />
                  )}
                </svg>
              </button>
            </div>
          )}
          <ContributionActionsMenu
            kindLabel={meta.kind}
            extraItems={
              photo
                ? []
                : [{ label: "Picture in Picture", onSelect: () => void togglePictureInPicture() }]
            }
            onDelete={onDelete}
          />
        </div>
      ) : null}
      </div>
      <figcaption className="flex items-start justify-between gap-2 px-3 py-2">
        <div className="min-w-0 space-y-1">
          <button
            type="button"
            className="block max-w-full truncate text-left text-xs text-gray-500"
            onClick={(e) => onSelectToggle?.(e.shiftKey || e.metaKey || e.ctrlKey)}
          >
            {participantName || "Anonymous"}
          </button>
          {caption ? <p className="line-clamp-3 text-xs text-gray-300">{caption}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onSelectToggle ? (
            <input
              type="checkbox"
              checked={selected}
              readOnly
              onClick={(e) => {
                e.stopPropagation();
                onSelectToggle(true);
              }}
              className="h-4 w-4 accent-[var(--csc-accent)]"
              aria-label={`Select ${meta.kind} from ${participantName || "Anonymous"}`}
            />
          ) : null}
          {url.trim() && !failed ? (
            <button
              type="button"
              draggable
              onDragStart={(e) => void handleDragStart(e)}
              onDragEnd={() => setDragging(false)}
              title={`Drag this ${meta.kind} into Finder`}
              className="cursor-grab rounded-lg border border-dashed border-white/15 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-500 hover:border-[var(--csc-accent)]/40 hover:text-[var(--csc-accent)] active:cursor-grabbing"
            >
              Drag
            </button>
          ) : null}
        </div>
      </figcaption>
    </figure>
  );
}
