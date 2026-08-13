import type { RunwayReferenceImage } from "@/lib/song-garden-v2/runway";

/** Runway gen4_image allows max 3 reference images. */
export const STORYBOARD_MAX_REFS = 3;

export function placeTagFor(index: number): string {
  return index === 0 ? "place" : `place${index + 1}`;
}

/**
 * Normalize client place refs (URLs or data URIs). Caps at Runway’s 3-ref limit.
 * Accepts legacy singular `imageDataUrl` plus `imageDataUrls` / `referenceUrls`.
 */
export function normalizePlaceReferenceUris(input: {
  referenceUrls?: unknown;
  imageDataUrls?: unknown;
  imageDataUrl?: unknown;
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  function push(raw: unknown) {
    if (typeof raw !== "string") return;
    const uri = raw.trim();
    if (!uri || seen.has(uri)) return;
    if (!/^https?:\/\//i.test(uri) && !/^data:image\//i.test(uri)) return;
    seen.add(uri);
    out.push(uri);
  }

  if (Array.isArray(input.referenceUrls)) input.referenceUrls.forEach(push);
  if (Array.isArray(input.imageDataUrls)) input.imageDataUrls.forEach(push);
  push(input.imageDataUrl);

  return out.slice(0, STORYBOARD_MAX_REFS);
}

/** Prefer neighbor stills so a regen matches the board. */
export function pickSiblingReferences(
  siblingSceneUrls: string[],
  frameIndex: number,
  frameCount: number,
  maxCount: number = STORYBOARD_MAX_REFS
): RunwayReferenceImage[] {
  if (maxCount <= 0) return [];
  const slots: { index: number; uri: string }[] = [];
  const seen = new Set<string>();

  function consider(i: number) {
    if (i < 0 || i >= frameCount || i === frameIndex) return;
    const uri = siblingSceneUrls[i]?.trim();
    if (!uri || seen.has(uri)) return;
    seen.add(uri);
    slots.push({ index: i, uri });
  }

  consider(frameIndex - 1);
  consider(frameIndex + 1);
  consider(0);
  consider(frameCount - 1);
  for (let i = 0; i < frameCount && slots.length < maxCount; i += 1) consider(i);

  return slots.slice(0, maxCount).map((s, n) => ({
    uri: s.uri,
    tag: `world${n + 1}`,
  }));
}

/**
 * Merge place + sibling refs into ≤3 Runway references.
 * - Full generate (no siblings): all place refs.
 * - Regen: keep 1 sibling for board continuity when available, fill the rest with place refs,
 *   then remaining siblings.
 */
export function mergeStoryboardReferences(opts: {
  placeUris: string[];
  siblingSceneUrls?: Array<string | null | undefined>;
  frameIndex: number;
  frameCount: number;
}): { referenceImages: RunwayReferenceImage[]; placeTags: string[]; siblingTags: string[] } {
  const placeUris = opts.placeUris.map((u) => u.trim()).filter(Boolean).slice(0, STORYBOARD_MAX_REFS);
  const hasSiblings = (opts.siblingSceneUrls ?? []).some(
    (u, i) => i !== opts.frameIndex && Boolean(u?.trim())
  );

  if (!hasSiblings) {
    const referenceImages = placeUris.map((uri, i) => ({
      uri,
      tag: placeTagFor(i),
    }));
    return {
      referenceImages,
      placeTags: referenceImages.map((r) => r.tag),
      siblingTags: [],
    };
  }

  const placeBudget = placeUris.length > 0 ? Math.min(placeUris.length, STORYBOARD_MAX_REFS - 1) : 0;
  const siblingBudget = STORYBOARD_MAX_REFS - placeBudget;
  const siblingRefs = pickSiblingReferences(
    (opts.siblingSceneUrls ?? []).map((u) => u ?? ""),
    opts.frameIndex,
    Math.max(opts.frameCount, opts.siblingSceneUrls?.length ?? 0),
    siblingBudget
  );

  const referenceImages: RunwayReferenceImage[] = [];
  const placeTags: string[] = [];
  const siblingTags: string[] = [];

  if (siblingRefs[0]) {
    referenceImages.push(siblingRefs[0]);
    siblingTags.push(siblingRefs[0].tag);
  }

  for (let i = 0; i < placeUris.length && referenceImages.length < STORYBOARD_MAX_REFS; i += 1) {
    const tag = placeTagFor(i);
    referenceImages.push({ uri: placeUris[i], tag });
    placeTags.push(tag);
  }

  for (let i = 1; i < siblingRefs.length && referenceImages.length < STORYBOARD_MAX_REFS; i += 1) {
    referenceImages.push(siblingRefs[i]);
    siblingTags.push(siblingRefs[i].tag);
  }

  return { referenceImages, placeTags, siblingTags };
}
