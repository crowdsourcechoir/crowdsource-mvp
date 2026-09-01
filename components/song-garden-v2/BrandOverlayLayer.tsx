"use client";

import type { BrandOverlay } from "@/lib/song-garden-v2/garden/types";
import {
  brandOverlayAnchorStyle,
  resolveBrandOverlays,
} from "@/lib/song-garden-v2/brand-overlays";
import type { BrandKit } from "@/lib/song-garden-v2/garden/types";

type Props = {
  brand: Pick<BrandKit, "logoUrl" | "overlays">;
  /** Higher z-index when overlays should sit above map chrome. */
  className?: string;
  /** When set, only render overlays (skip legacy header logo duplication). */
  overlaysOnly?: boolean;
};

/**
 * Fixed-position client logos and brand graphics on the live garden / journey.
 * pointer-events-none so map taps and prompts stay usable underneath.
 */
export default function BrandOverlayLayer({ brand, className = "", overlaysOnly = true }: Props) {
  const overlays = resolveBrandOverlays(brand);
  if (!overlays.length) return null;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[18] ${className}`.trim()}
      aria-hidden={overlaysOnly}
    >
      {overlays.map((overlay) => (
        <BrandOverlayGraphic key={overlay.id} overlay={overlay} />
      ))}
    </div>
  );
}

function BrandOverlayGraphic({ overlay }: { overlay: BrandOverlay }) {
  const style = brandOverlayAnchorStyle(overlay.anchor, overlay.offsetX, overlay.offsetY);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={overlay.url}
      alt={overlay.label?.trim() || ""}
      className="absolute h-auto w-auto drop-shadow-lg"
      style={{
        ...style,
        maxWidth: overlay.maxWidthPx,
        opacity: overlay.opacity,
      }}
    />
  );
}
