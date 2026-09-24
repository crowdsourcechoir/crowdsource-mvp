import { slides, type CopyBlock, type PitchSlide } from "@/app/sobeca-song-garden/content";
import { readWorkspaceSettings } from "@/lib/settings/store";

function overlayBlock(base: CopyBlock, incoming: unknown): CopyBlock {
  if (!incoming || typeof incoming !== "object") return base;
  const next = incoming as CopyBlock;
  if (next.type !== base.type) return base;

  if (base.type === "list" && next.type === "list" && Array.isArray(next.items) && next.items.length === base.items.length) {
    return {
      ...base,
      items: base.items.map((item, index) => (typeof next.items[index] === "string" ? next.items[index] : item)),
    };
  }

  if (base.type === "table" && next.type === "table" && Array.isArray(next.rows)) {
    return {
      ...base,
      headers: base.headers.map((header, index) =>
        typeof next.headers?.[index] === "string" ? next.headers[index] : header
      ),
      rows: base.rows.map((row, rowIndex) =>
        row.map((cell, cellIndex) => {
          const value = next.rows?.[rowIndex]?.[cellIndex];
          return typeof value === "string" ? value : cell;
        })
      ),
    };
  }

  if ("text" in base && "text" in next && typeof next.text === "string") {
    return { ...base, text: next.text };
  }

  if (base.type === "image" && next.type === "image" && typeof next.alt === "string") {
    return { ...base, alt: next.alt };
  }

  return base;
}

/** Keep images and structure from code. Only saved words replace the defaults. */
export function applyStoredCopy(stored: unknown): PitchSlide[] {
  if (!Array.isArray(stored)) return slides;
  return slides.map((slide) => {
    const match = stored.find((item) => item && typeof item === "object" && (item as PitchSlide).id === slide.id) as
      | PitchSlide
      | undefined;
    if (!match || !Array.isArray(match.blocks)) return slide;
    return {
      ...slide,
      blocks: slide.blocks.map((block, index) => overlayBlock(block, match.blocks[index])),
    };
  });
}

export async function resolveSongGardenSlides(): Promise<PitchSlide[]> {
  const stored = await readWorkspaceSettings({ skipCache: true });
  return applyStoredCopy(stored.settings.songGarden);
}
