export type SlideGesture = "next" | "prev" | "none";

/** Decide whether a pointer gesture moves the deck. */
export function slideGesture(input: {
  dx: number;
  dy: number;
  x: number;
  width: number;
  interactive: boolean;
}): SlideGesture {
  if (input.interactive) return "none";
  const absX = Math.abs(input.dx);
  const absY = Math.abs(input.dy);
  if (absX < 12 && absY < 12) {
    if (input.width <= 0) return "none";
    return input.x < input.width * 0.32 ? "prev" : "next";
  }
  if (absX < 56 || absX < absY * 1.15) return "none";
  return input.dx < 0 ? "next" : "prev";
}

export function stepSlide(index: number, count: number, direction: SlideGesture): number {
  if (direction === "none" || count <= 0) return index;
  const next = index + (direction === "next" ? 1 : -1);
  return Math.min(count - 1, Math.max(0, next));
}
