import type { CopyBlock } from "@/app/sobeca-song-garden/content";
import { plainPitchText } from "@/lib/pitches/rich-text";

export type SlideGesture = "next" | "prev" | "none";

export type DeckStep = { index: number; revealed: boolean };

const TEXT_STYLES = new Set(["kicker", "title", "heading", "heading2", "heading3", "paragraph", "line"]);

/** Text held for the next click. A Line stays where it was placed. */
export function punchCopy(_blocks: CopyBlock[], bottom?: string): { index: number; before: string; text: string } | null {
  const text = bottom?.trim() ?? "";
  if (!text) return null;
  return { index: -1, before: "", text };
}

/** The closing Line, pinned to the bottom. Stepped slides keep every Line in order. A marked line waits for its click. */
export function pinnedLine(slide: { reveal?: string; blocks: CopyBlock[] }): { index: number; text: string } | null {
  if (slide.reveal === "steps") return null;
  const index = slide.blocks.length - 1;
  const block = slide.blocks[index];
  if (block?.type === "line" && block.text.trim() && block.click !== true) return { index, text: block.text.trim() };
  return null;
}

export type ClickBeat = { blockIndex: number; itemIndex?: number };

/** Rows marked Next click, in reading order. Each click brings the next one onto the slide. */
export function clickBeats(blocks: CopyBlock[]): ClickBeat[] {
  const beats: ClickBeat[] = [];
  blocks.forEach((block, blockIndex) => {
    if (block.type === "list") {
      const marks = [...new Set(block.clickItems ?? [])].filter((index) => Number.isInteger(index)).sort((a, b) => a - b);
      marks.forEach((itemIndex) => {
        if (block.items[itemIndex]?.trim()) beats.push({ blockIndex, itemIndex });
      });
      return;
    }
    if ("text" in block && block.click === true && block.text.trim()) beats.push({ blockIndex });
  });
  return beats;
}

export function clickBeatHidden(beats: ClickBeat[], blockIndex: number, itemIndex: number | undefined, shown: number): boolean {
  const at = beats.findIndex((beat) => beat.blockIndex === blockIndex && beat.itemIndex === itemIndex);
  return at >= 0 && at >= shown;
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

export type PacedSlide = { reveal?: string; blocks: CopyBlock[]; bottom?: string };

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

function clickCount(slide: PacedSlide | undefined): number {
  if (!slide) return 0;
  return clickBeats(slide.blocks).length;
}

function heldBottom(slide: PacedSlide | undefined): boolean {
  const text = plainPitchText(slide?.bottom ?? "").trim();
  if (!text) return false;
  const pinned = slide ? pinnedLine(slide) : null;
  return !pinned || pinned.text !== text;
}

function enterSlide(slides: PacedSlide[], index: number, from: "prev" | "next", revealed = false): PresentStep {
  const slide = slides[index];
  const clicks = clickCount(slide);
  if (clicks > 0) {
    return { index, revealed: from === "prev" && heldBottom(slide), arrived: from === "prev" ? clicks : 0 };
  }
  const total = pacedCount(slide);
  if (total > 0) {
    return { index, revealed: from === "prev" && heldBottom(slide), arrived: from === "prev" ? total : 0 };
  }
  return { index, revealed: from === "prev" ? heldBottom(slide) : revealed, arrived: 0 };
}

/**
 * Marked rows come in one click at a time, in reading order. An extra bottom line follows them.
 * A stepped slide with no marks starts empty and reveals every line. All-at-once slides hold only that bottom line.
 */
export function nextPresentStep(state: PresentStep, slides: PacedSlide[], direction: SlideGesture): PresentStep {
  if (direction === "none" || slides.length === 0) return state;
  const slide = slides[state.index];
  const clicks = clickCount(slide);
  if (clicks > 0) {
    if (direction === "next") {
      if (state.arrived < clicks) return { index: state.index, revealed: false, arrived: state.arrived + 1 };
      if (heldBottom(slide) && !state.revealed) return { index: state.index, revealed: true, arrived: state.arrived };
      const index = Math.min(slides.length - 1, state.index + 1);
      if (index === state.index) return state;
      return enterSlide(slides, index, "next");
    }
    if (state.revealed) return { index: state.index, revealed: false, arrived: state.arrived };
    if (state.arrived > 0) return { index: state.index, revealed: false, arrived: state.arrived - 1 };
    const index = Math.max(0, state.index - 1);
    if (index === state.index) return state;
    return enterSlide(slides, index, "prev");
  }
  const total = pacedCount(slide);
  if (total > 0) {
    if (direction === "next") {
      if (state.arrived < total) return { index: state.index, revealed: false, arrived: state.arrived + 1 };
      if (heldBottom(slide) && !state.revealed) return { index: state.index, revealed: true, arrived: state.arrived };
      const index = Math.min(slides.length - 1, state.index + 1);
      if (index === state.index) return state;
      return enterSlide(slides, index, "next");
    }
    if (state.revealed) return { index: state.index, revealed: false, arrived: state.arrived };
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
    heldBottom(slide),
    Boolean(previous && previous.reveal !== "steps" && heldBottom(previous)),
  );
  if (
    punched.index !== state.index &&
    (clickCount(slides[punched.index]) > 0 || pacedCount(slides[punched.index]) > 0)
  ) {
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
