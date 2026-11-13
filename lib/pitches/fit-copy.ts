/** Below this, shrinking copy is worse than letting the slide scroll. */
export const FIT_COPY_MIN_SCALE = 0.85;

/** Uniform scale that keeps a slide's text inside the frame. 1 means it already fits. */
export function evenFitScale(
  availableWidth: number,
  availableHeight: number,
  contentWidth: number,
  contentHeight: number
): number {
  if (availableWidth <= 0 || availableHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) return 1;
  const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1);
  return Math.round(scale * 1000) / 1000;
}

/**
 * Prefer a light shrink to keep a deck slide tidy. Past the floor, keep type
 * readable and let the caller scroll instead of crushing the copy.
 */
export function fitCopyLayout(
  availableWidth: number,
  availableHeight: number,
  contentWidth: number,
  contentHeight: number,
  minScale = FIT_COPY_MIN_SCALE
): { scale: number; scroll: boolean } {
  const scale = evenFitScale(availableWidth, availableHeight, contentWidth, contentHeight);
  const floor = Math.min(Math.max(minScale, 0), 1);
  if (scale >= floor) return { scale, scroll: false };
  return { scale: 1, scroll: true };
}
