"use client";

import { useRef, useState, type DragEvent } from "react";
import ContributionActionsMenu from "@/components/songgarden/ContributionActionsMenu";
import { isPhotoMediaUrl, mediaDragMeta } from "@/lib/composer/media-drag";

type Props = {
  url: string;
  participantName: string;
  caption?: string | null;
  onDelete?: () => Promise<void>;
};

/** Composer video/photo card: drag the file out, and delete with a confirmed menu. */
export default function ComposerMediaCard({
  url,
  participantName,
  caption,
  onDelete,
}: Props) {
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
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
        dragging ? "border-[var(--csc-accent)]/50 opacity-60" : "border-white/10"
      }`}
    >
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
          src={url}
          controls
          playsInline
          preload="metadata"
          className="aspect-[9/16] w-full bg-black object-cover"
          onError={() => setFailed(true)}
        />
      )}
      <figcaption className="flex items-start justify-between gap-2 px-3 py-2">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs text-gray-500">{participantName || "Anonymous"}</p>
          {caption ? <p className="line-clamp-3 text-xs text-gray-300">{caption}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
          {onDelete ? (
            <ContributionActionsMenu kindLabel={meta.kind} onDelete={onDelete} />
          ) : null}
        </div>
      </figcaption>
    </figure>
  );
}
