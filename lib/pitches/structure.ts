import type { CopyBlock, PitchSlide } from "@/app/sobeca-song-garden/content";
import { libraryPhoto } from "@/lib/pitches/photo-library";

export const MAX_PITCH_SLIDES = 40;
export const MAX_SLIDE_BLOCKS = 40;
const MAX_LIST_ITEMS = 40;
const MAX_TABLE_ROWS = 40;

export type TextBlockType = "title" | "heading" | "kicker" | "line" | "paragraph";

export type SlideEdit = { slides: PitchSlide[]; id?: string } | { error: string };

export function newSlideId(slides: { id: string }[]): string {
  const taken = new Set(slides.map((slide) => slide.id));
  for (let n = 1; n < 1000; n += 1) {
    const id = `slide-${n}`;
    if (!taken.has(id)) return id;
  }
  return `slide-${taken.size + 1}`.slice(0, 40);
}

export function newSlide(id: string): PitchSlide {
  const photo = libraryPhoto("conductor");
  return {
    id,
    image: photo.src,
    imageAlt: photo.alt,
    wash: 0.28,
    blocks: [{ type: "heading", text: "New slide" }],
  };
}

export function insertSlide(slides: PitchSlide[], afterId: string | null): SlideEdit {
  if (slides.length >= MAX_PITCH_SLIDES) return { error: "This pitch already has 40 slides." };
  const id = newSlideId(slides);
  const slide = newSlide(id);
  if (!afterId) return { slides: [...slides, slide], id };
  const index = slides.findIndex((item) => item.id === afterId);
  if (index < 0) return { slides: [...slides, slide], id };
  const next = slides.slice();
  next.splice(index + 1, 0, slide);
  return { slides: next, id };
}

export function removeSlide(slides: PitchSlide[], id: string): SlideEdit {
  if (!slides.some((slide) => slide.id === id)) return { slides };
  if (slides.length <= 1) return { error: "A pitch needs at least one slide." };
  return { slides: slides.filter((slide) => slide.id !== id) };
}

export function moveSlide(slides: PitchSlide[], id: string, direction: -1 | 1): SlideEdit {
  const index = slides.findIndex((slide) => slide.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= slides.length) return { slides };
  const next = slides.slice();
  const [slide] = next.splice(index, 1);
  next.splice(target, 0, slide);
  return { slides: next };
}

function addBlock(slides: PitchSlide[], slideId: string, block: CopyBlock): SlideEdit {
  const slide = slides.find((item) => item.id === slideId);
  if (!slide) return { slides };
  if (slide.blocks.length >= MAX_SLIDE_BLOCKS) return { error: "This slide already has 40 blocks." };
  return {
    slides: slides.map((item) => (item.id === slideId ? { ...item, blocks: [...item.blocks, block] } : item)),
  };
}

export function addTextBlock(slides: PitchSlide[], slideId: string, type: TextBlockType = "paragraph"): SlideEdit {
  return addBlock(slides, slideId, { type, text: "" });
}

export function addListBlock(slides: PitchSlide[], slideId: string): SlideEdit {
  return addBlock(slides, slideId, { type: "list", items: [""] });
}

export function addTableBlock(slides: PitchSlide[], slideId: string): SlideEdit {
  return addBlock(slides, slideId, { type: "table", headers: ["Column", "Detail"], rows: [["", ""]] });
}

export function removeBlock(slides: PitchSlide[], slideId: string, index: number): SlideEdit {
  const slide = slides.find((item) => item.id === slideId);
  if (!slide || index < 0 || index >= slide.blocks.length) return { slides };
  if (slide.blocks.length <= 1) return { error: "A slide needs at least one block. Delete the slide to remove it." };
  return {
    slides: slides.map((item) =>
      item.id === slideId ? { ...item, blocks: item.blocks.filter((_, blockIndex) => blockIndex !== index) } : item
    ),
  };
}

export function moveBlock(slides: PitchSlide[], slideId: string, index: number, direction: -1 | 1): SlideEdit {
  return {
    slides: slides.map((slide) => {
      if (slide.id !== slideId) return slide;
      const target = index + direction;
      if (index < 0 || target < 0 || index >= slide.blocks.length || target >= slide.blocks.length) return slide;
      const blocks = slide.blocks.slice();
      const [block] = blocks.splice(index, 1);
      blocks.splice(target, 0, block);
      return { ...slide, blocks };
    }),
  };
}

function mapBlock(
  slides: PitchSlide[],
  slideId: string,
  blockIndex: number,
  recipe: (block: CopyBlock) => CopyBlock | { error: string }
): SlideEdit {
  const slide = slides.find((item) => item.id === slideId);
  const block = slide?.blocks[blockIndex];
  if (!slide || !block) return { slides };
  const next = recipe(block);
  if ("error" in next) return next;
  return {
    slides: slides.map((item) => {
      if (item.id !== slideId) return item;
      const blocks = item.blocks.slice();
      blocks[blockIndex] = next;
      return { ...item, blocks };
    }),
  };
}

export function addListItem(slides: PitchSlide[], slideId: string, blockIndex: number): SlideEdit {
  return mapBlock(slides, slideId, blockIndex, (block) => {
    if (block.type !== "list") return block;
    if (block.items.length >= MAX_LIST_ITEMS) return { error: "This list already has 40 lines." };
    return { ...block, items: [...block.items, ""] };
  });
}

export function removeListItem(slides: PitchSlide[], slideId: string, blockIndex: number, itemIndex: number): SlideEdit {
  return mapBlock(slides, slideId, blockIndex, (block) => {
    if (block.type !== "list") return block;
    if (block.items.length <= 1) return { error: "A list needs at least one line. Delete the list to remove it." };
    return { ...block, items: block.items.filter((_, index) => index !== itemIndex) };
  });
}

export function addTableRow(slides: PitchSlide[], slideId: string, blockIndex: number): SlideEdit {
  return mapBlock(slides, slideId, blockIndex, (block) => {
    if (block.type !== "table") return block;
    if (block.rows.length >= MAX_TABLE_ROWS) return { error: "This table already has 40 rows." };
    return { ...block, rows: [...block.rows, block.headers.map(() => "")] };
  });
}

export function removeTableRow(slides: PitchSlide[], slideId: string, blockIndex: number, rowIndex: number): SlideEdit {
  return mapBlock(slides, slideId, blockIndex, (block) => {
    if (block.type !== "table") return block;
    if (block.rows.length <= 1) return { error: "A table needs at least one row. Delete the table to remove it." };
    return { ...block, rows: block.rows.filter((_, index) => index !== rowIndex) };
  });
}
