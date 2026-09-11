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
    <div className="pointer-events-none relative z-20 mx-auto mt-2 flex w-full max-w-lg shrink-0 justify-center px-4 sm:mt-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="h-auto w-auto max-h-[18vh] max-w-[min(100%,42vw)] opacity-95 drop-shadow-lg sm:max-h-none sm:max-w-full"
        style={{ maxWidth: width }}
      />
    </div>
  );
}
