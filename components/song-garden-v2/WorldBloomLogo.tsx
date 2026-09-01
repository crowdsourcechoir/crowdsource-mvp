"use client";

import { resolveBloomLogoMaxWidthPx } from "@/lib/song-garden-v2/world-config";

type Props = {
  url: string;
  maxWidthPx?: number | null;
};

/** Client logo on the bloom journey — below world title, above the presence bubble. */
export default function WorldBloomLogo({ url, maxWidthPx }: Props) {
  const src = url.trim();
  if (!src) return null;
  const width = resolveBloomLogoMaxWidthPx(maxWidthPx);
  return (
    <div className="pointer-events-none relative z-20 mx-auto mt-3 flex w-full max-w-lg shrink-0 justify-center px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="h-auto w-auto max-w-full opacity-95 drop-shadow-lg"
        style={{ maxWidth: width }}
      />
    </div>
  );
}
