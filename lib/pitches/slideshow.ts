import type { CopyBlock } from "@/app/sobeca-song-garden/content";

export type SlideGesture = "next" | "prev" | "none";

export type DeckStep = { index: number; revealed: boolean };

const TEXT_STYLES = new Set(["kicker", "title", "heading", "heading2", "heading3", "paragraph", "line"]);

/** The line held for a second click. Only a line block. A paragraph stays a paragraph. */
export function punchCopy(blocks: CopyBlock[]): { index: number; before: string; text: string } | null {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.type === "line" && block.text.trim()) return { index, before: "", text: block.text.trim() };
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

export type CopyStep = { blockIndex: number; itemIndex?: number; rowIndex?: number };

export type PresentStep = { index: number; revealed: boolean; arrived: number };

export type PacedSlide = { reveal?: string; blocks: CopyBlock[] };

/** One presenter click. List items and table rows each count. Blank lines do not. */
export function copySteps(blocks: CopyBlock[]): CopyStep[] {
  const steps: CopyStep[] = [];
  blocks.forEach((block, blockIndex) => {
    if (block.type === "list") {
      block.items.forEach((item, itemIndex) => {
        if (item.trim()) steps.push({ blockIndex, itemIndex });
      });
      return;
    }
    if (block.type === "table") {
      block.rows.forEach((_, rowIndex) => steps.push({ blockIndex, rowIndex }));
      return;
    }
    if (block.type === "image") {
      if (block.src.trim()) steps.push({ blockIndex });
      return;
    }
    if ("text" in block && block.text.trim()) steps.push({ blockIndex });
  });
  return steps;
}

function pacedCount(slide: PacedSlide | undefined): number {
  if (!slide || slide.reveal !== "steps") return 0;
  return copySteps(slide.blocks).length;
}

function enterSlide(slides: PacedSlide[], index: number, from: "prev" | "next", revealed = false): PresentStep {
  const total = pacedCount(slides[index]);
  if (total > 0) return { index, revealed: false, arrived: from === "prev" ? total : 0 };
  return { index, revealed, arrived: 0 };
}

/**
 * All-at-once slides keep the held last line.
 * A stepped slide starts empty. Each forward click reveals the next line, and the click after the last line leaves the slide.
 */
export function nextPresentStep(state: PresentStep, slides: PacedSlide[], direction: SlideGesture): PresentStep {
  if (direction === "none" || slides.length === 0) return state;
  const slide = slides[state.index];
  const total = pacedCount(slide);
  if (total > 0) {
    if (direction === "next") {
      if (state.arrived < total) return { index: state.index, revealed: false, arrived: state.arrived + 1 };
      const index = Math.min(slides.length - 1, state.index + 1);
      if (index === state.index) return state;
      return enterSlide(slides, index, "next");
    }
    if (state.arrived > 0) return { index: state.index, revealed: false, arrived: state.arrived - 1 };
    const index = Math.max(0, state.index - 1);
    if (index === state.index) return state;
    return enterSlide(slides, index, "prev");
  }

  const previous = slides[Math.max(0, state.index - 1)];
  const punched = nextDeckStep(
    { index: state.index, revealed: state.revealed },
    slides.length,
    direction,
    Boolean(slide && punchCopy(slide.blocks)),
    Boolean(previous && previous.reveal !== "steps" && punchCopy(previous.blocks)),
  );
  if (punched.index !== state.index && pacedCount(slides[punched.index]) > 0) {
    return enterSlide(slides, punched.index, direction === "prev" ? "prev" : "next");
  }
  if (punched.index === state.index) return { ...state, revealed: punched.revealed };
  return { index: punched.index, revealed: punched.revealed, arrived: 0 };
}

export function stepSlide(index: number, count: number, direction: SlideGesture): number {
  if (direction === "none" || count <= 0) return index;
  const next = index + (direction === "next" ? 1 : -1);
  return Math.min(count - 1, Math.max(0, next));
}
