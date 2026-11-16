import type { CopyBlock } from "@/app/sobeca-song-garden/content";

const HARD_BREAK = new Set(["title", "heading", "line"]);

export type SectionHeading = CopyBlock & { type: "heading2" | "heading3" };

/**
 * The Heading 2 or Heading 3 that owns this block.
 * A title, a main heading, or a line ends the run. The next subhead starts a new one.
 */
export function sectionOwner(blocks: CopyBlock[], index: number): SectionHeading | null {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const block = blocks[cursor];
    if (!block) continue;
    if (block.type === "heading2" || block.type === "heading3") return block;
    if (HARD_BREAK.has(block.type)) return null;
  }
  return null;
}

/** Body under a subhead stays indented until the next header, unless that header turned it off. */
export function sectionIndentDefault(blocks: CopyBlock[], index: number): boolean {
  const owner = sectionOwner(blocks, index);
  return owner ? owner.indent !== false : false;
}

/** The indent choice for a paragraph, before a lime bar takes its own offset. */
export function paragraphIndentChoice(blocks: CopyBlock[], index: number): boolean {
  const block = blocks[index];
  if (!block || block.type !== "paragraph") return false;
  if (block.indent === true) return true;
  if (block.indent === false) return false;
  return sectionIndentDefault(blocks, index);
}

/** Left padding on the slide. A paragraph with a lime bar already sits in from the edge. */
export function paragraphDrawsIndent(blocks: CopyBlock[], index: number): boolean {
  const block = blocks[index];
  if (!block || block.type !== "paragraph" || block.rule) return false;
  return paragraphIndentChoice(blocks, index);
}
