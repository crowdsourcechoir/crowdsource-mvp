"use client";

import { useState } from "react";

function isPhotoUrl(url: string): boolean {
  if (/^data:image\//i.test(url)) return true;
  try {
    const decoded = decodeURIComponent(url);
    return (
      /\.(jpe?g|png|webp|gif)(\?|$)/i.test(decoded) ||
      /\/photo-/i.test(decoded) ||
      /(^|[/?&=])photo-/i.test(decoded)
    );
  } catch {
    return (
      /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url) ||
      /\/photo-/i.test(url) ||
      /photo-/i.test(url)
    );
  }
}

/** Composer video/photo card with explicit load-error state. */
export default function ComposerMediaCard({
  url,
  participantName,
  caption,
}: {
  url: string;
  participantName: string;
  caption?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const photo = isPhotoUrl(url);

  if (!url.trim()) {
    return (
      <figure className="overflow-hidden rounded-xl border border-red-800/40 bg-red-950/30">
        <p className="flex aspect-video items-center justify-center px-3 text-center text-xs text-red-300">
          Could not load media for this response.
        </p>
        <figcaption className="space-y-1 px-3 py-2">
          <p className="text-xs text-gray-500">{participantName || "Anonymous"}</p>
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
      {failed ? (
        <p className="flex aspect-video items-center justify-center border border-red-800/40 bg-red-950/30 px-3 text-center text-xs text-red-300">
          Could not load {photo ? "photo" : "video"} for this response.
        </p>
      ) : photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- contributor upload URL
        <img
          src={url}
          alt=""
          className="aspect-video w-full bg-black object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black"
          onError={() => setFailed(true)}
        />
      )}
      <figcaption className="space-y-1 px-3 py-2">
        <p className="text-xs text-gray-500">{participantName || "Anonymous"}</p>
        {caption ? <p className="line-clamp-3 text-xs text-gray-300">{caption}</p> : null}
      </figcaption>
    </figure>
  );
}
