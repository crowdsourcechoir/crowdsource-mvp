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
