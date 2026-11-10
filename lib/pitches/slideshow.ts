import type { CopyBlock } from "@/app/sobeca-song-garden/content";

export type SlideGesture = "next" | "prev" | "none";

export type DeckStep = { index: number; revealed: boolean };

const TEXT_STYLES = new Set(["kicker", "title", "heading", "heading2", "paragraph", "line"]);

export function splitLastSentence(text: string): { before: string; last: string } {
  const trimmed = text.trim();
  const parts = trimmed.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
  if (parts.length <= 1) return { before: "", last: trimmed };
  const last = parts[parts.length - 1];
  const before = trimmed.slice(0, trimmed.length - last.length).trim();
  return { before, last };
}

/** The line held for a second click. A line block wins. Otherwise the last sentence. */
export function punchCopy(blocks: CopyBlock[]): { index: number; before: string; text: string } | null {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.type === "line" && block.text.trim()) return { index, before: "", text: block.text.trim() };
  }
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.type === "image") continue;
    if (block.type !== "paragraph") return null;
    const { before, last } = splitLastSentence(block.text);
    if (!last) return null;
    return { index, before, text: last };
  }
  return null;
}

export function isTextStyle(type: string): boolean {
  return TEXT_STYLES.has(type);
}

/**
 * A forward gesture reveals the bottom line before it advances.
 * A back gesture hides that line before it leaves the slide.
 */
export function nextDeckStep(
  state: DeckStep,
  count: number,
  direction: SlideGesture,
  hasPunch: boolean,
  previousHasPunch: boolean,
): DeckStep {
  if (direction === "none" || count <= 0) return state;
  if (direction === "next") {
    if (!state.revealed && hasPunch) return { index: state.index, revealed: true };
    const index = Math.min(count - 1, state.index + 1);
    if (index === state.index) return state;
    return { index, revealed: false };
  }
  if (state.revealed) return { index: state.index, revealed: false };
  const index = Math.max(0, state.index - 1);
  if (index === state.index) return state;
  return { index, revealed: previousHasPunch };
}

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
