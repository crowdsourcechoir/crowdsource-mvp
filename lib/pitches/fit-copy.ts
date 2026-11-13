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

/** Below this, a wide slide flows the body into a second column instead of shrinking the type. */
export const COPY_SPLIT_SCALE = 0.75;
/** Two columns need a real desktop-width frame — not a phone in landscape. */
export const COPY_SPLIT_MIN_WIDTH = 900;
/** Landscape phones are ~390 tall; keep one column and scroll instead of a skinny split. */
export const COPY_SPLIT_MIN_HEIGHT = 560;
/** Never shrink type below this — scroll the slide instead of making words unreadably small. */
export const COPY_MIN_SCALE = 0.9;

export function shouldSplitCopy(
  scale: number,
  frameWidth: number,
  frameHeight: number = Number.POSITIVE_INFINITY
): boolean {
  return (
    frameWidth >= COPY_SPLIT_MIN_WIDTH &&
    frameHeight >= COPY_SPLIT_MIN_HEIGHT &&
    scale > 0 &&
    scale < COPY_SPLIT_SCALE
  );
}

/** Phone / short / over-shrunk slides keep full type size and scroll. */
export function shouldScrollCopy(
  scale: number,
  frameWidth: number,
  frameHeight: number = Number.POSITIVE_INFINITY
): boolean {
  if (frameWidth < COPY_SPLIT_MIN_WIDTH || frameHeight < COPY_SPLIT_MIN_HEIGHT) return true;
  return scale > 0 && scale < COPY_MIN_SCALE;
}

/** Scale applied to the visible copy box. 1 when we scroll instead of shrink. */
export function displayFitScale(
  scale: number,
  frameWidth: number,
  frameHeight: number = Number.POSITIVE_INFINITY
): number {
  return shouldScrollCopy(scale, frameWidth, frameHeight) ? 1 : scale;
}

/**
 * Where the right column starts, as an index into the body blocks.
 * The length of the list means the slide stays one column.
 * A Heading 2 stays with the paragraph under it.
 */
export function columnSplitIndex(heights: number[], types: string[]): number {
  if (heights.length < 2 || heights.length !== types.length) return heights.length;
  if (types.some((type) => type === "table" || type === "image")) return heights.length;
  const total = heights.reduce((sum, height) => sum + Math.max(0, height), 0);
  if (total <= 0) return heights.length;
  const target = total / 2;
  let covered = 0;
  let cut = heights.length;
  for (let index = 0; index < heights.length; index += 1) {
    covered += Math.max(0, heights[index]);
    if (covered >= target) {
      cut = index + 1;
      break;
    }
  }
  if (cut < heights.length && types[cut - 1] === "heading2" && types[cut] === "paragraph") cut += 1;
  if (cut >= heights.length && types[heights.length - 2] === "heading2" && types[heights.length - 1] === "paragraph") {
    cut = heights.length - 2;
  }
  if (cut <= 0 || cut >= heights.length) return heights.length;
  return cut;
}
