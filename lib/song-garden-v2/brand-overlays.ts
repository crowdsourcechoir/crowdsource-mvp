import type { BrandKit, BrandOverlay, BrandOverlayAnchor } from "@/lib/song-garden-v2/garden/types";

export const BRAND_OVERLAY_ANCHORS: { id: BrandOverlayAnchor; label: string }[] = [
  { id: "top-left", label: "Top left" },
  { id: "top-center", label: "Top center" },
  { id: "top-right", label: "Top right" },
  { id: "middle-left", label: "Middle left" },
  { id: "middle-right", label: "Middle right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-right", label: "Bottom right" },
];

const ANCHOR_SET = new Set(BRAND_OVERLAY_ANCHORS.map((a) => a.id));

export function newBrandOverlayId(): string {
  return `ov_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeBrandOverlay(raw: BrandOverlay | null | undefined): BrandOverlay | null {
  if (!raw || typeof raw !== "object") return null;
  const url = raw.url?.trim();
  if (!url) return null;
  const anchor = ANCHOR_SET.has(raw.anchor) ? raw.anchor : "top-left";
  const maxWidthPx = Math.max(24, Math.min(480, Number(raw.maxWidthPx) || 120));
  const opacity = Math.max(0.05, Math.min(1, Number(raw.opacity) || 0.95));
  const offsetX = Math.max(-120, Math.min(120, Number(raw.offsetX) || 0));
  const offsetY = Math.max(-120, Math.min(120, Number(raw.offsetY) || 0));
  return {
    id: raw.id?.trim() || newBrandOverlayId(),
    url,
    label: raw.label?.trim() || null,
    anchor,
    offsetX,
    offsetY,
    maxWidthPx,
    opacity,
    enabled: raw.enabled !== false,
  };
}

export function normalizeBrandOverlays(
  overlays: BrandOverlay[] | null | undefined
): BrandOverlay[] {
  if (!Array.isArray(overlays)) return [];
  const out: BrandOverlay[] = [];
  const seen = new Set<string>();
  for (const item of overlays) {
    const normalized = normalizeBrandOverlay(item);
    if (!normalized) continue;
    let id = normalized.id;
    while (seen.has(id)) id = newBrandOverlayId();
    seen.add(id);
    out.push({ ...normalized, id });
  }
  return out;
}

/** Active overlays for the public UI — includes legacy logoUrl when no logo overlay exists. */
export function resolveBrandOverlays(brand: Pick<BrandKit, "logoUrl" | "overlays">): BrandOverlay[] {
  const enabled = normalizeBrandOverlays(brand.overlays).filter((o) => o.enabled !== false);
  if (enabled.length) return enabled;
  const logo = brand.logoUrl?.trim();
  if (!logo) return [];
  return [
    {
      id: "legacy-logo",
      url: logo,
      label: "Logo",
      anchor: "top-left",
      offsetX: 0,
      offsetY: 0,
      maxWidthPx: 112,
      opacity: 0.95,
      enabled: true,
    },
  ];
}

type AnchorStyle = {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  transform?: string;
};

export function brandOverlayAnchorStyle(
  anchor: BrandOverlayAnchor,
  offsetX: number,
  offsetY: number
): AnchorStyle {
  const safeTop = `max(0.75rem, env(safe-area-inset-top))`;
  const safeBottom = `max(0.75rem, env(safe-area-inset-bottom))`;
  const safeLeft = `max(0.75rem, env(safe-area-inset-left))`;
  const safeRight = `max(0.75rem, env(safe-area-inset-right))`;

  switch (anchor) {
    case "top-left":
      return {
        top: `calc(${safeTop} + ${offsetY}px)`,
        left: `calc(${safeLeft} + ${offsetX}px)`,
      };
    case "top-center":
      return {
        top: `calc(${safeTop} + ${offsetY}px)`,
        left: "50%",
        transform: `translateX(calc(-50% + ${offsetX}px))`,
      };
    case "top-right":
      return {
        top: `calc(${safeTop} + ${offsetY}px)`,
        right: `calc(${safeRight} - ${offsetX}px)`,
      };
    case "middle-left":
      return {
        top: "50%",
        left: `calc(${safeLeft} + ${offsetX}px)`,
        transform: `translateY(calc(-50% + ${offsetY}px))`,
      };
    case "middle-right":
      return {
        top: "50%",
        right: `calc(${safeRight} - ${offsetX}px)`,
        transform: `translateY(calc(-50% + ${offsetY}px))`,
      };
    case "bottom-left":
      return {
        bottom: `calc(${safeBottom} - ${offsetY}px)`,
        left: `calc(${safeLeft} + ${offsetX}px)`,
      };
    case "bottom-center":
      return {
        bottom: `calc(${safeBottom} - ${offsetY}px)`,
        left: "50%",
        transform: `translateX(calc(-50% + ${offsetX}px))`,
      };
    case "bottom-right":
      return {
        bottom: `calc(${safeBottom} - ${offsetY}px)`,
        right: `calc(${safeRight} - ${offsetX}px)`,
      };
    default:
      return {
        top: `calc(${safeTop} + ${offsetY}px)`,
        left: `calc(${safeLeft} + ${offsetX}px)`,
      };
  }
}
