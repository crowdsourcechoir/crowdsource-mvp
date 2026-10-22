import { slides, type CopyBlock, type PitchSlide } from "@/app/sobeca-song-garden/content";
import { readWorkspaceSettings } from "@/lib/settings/store";

export const DEFAULT_COPY_COLOR = "#FFFFFF";

export type SongGardenPitch = {
  slides: PitchSlide[];
  copyColor: string;
};

function safeImage(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const url = value.trim();
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return url;
  } catch {
    return fallback;
  }
  return fallback;
}

export function safeCopyColor(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_COPY_COLOR;
  const color = value.trim();
  return /^#([0-9a-fA-F]{6})$/.test(color) ? color.toUpperCase() : DEFAULT_COPY_COLOR;
}

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

function slidesFrom(stored: unknown): unknown {
  if (Array.isArray(stored)) return stored;
  if (stored && typeof stored === "object" && "slides" in stored) return (stored as { slides?: unknown }).slides;
  return null;
}

function colorFrom(stored: unknown): unknown {
  if (stored && typeof stored === "object" && !Array.isArray(stored) && "copyColor" in stored) {
    return (stored as { copyColor?: unknown }).copyColor;
  }
  return null;
}

/** Keep structure from code. Saved words, background URLs, and copy color replace the defaults. */
export function applyStoredCopy(stored: unknown): SongGardenPitch {
  const incomingSlides = slidesFrom(stored);
  const fallbackColor = safeCopyColor(colorFrom(stored));
  const nextSlides = slides.map((slide) => {
    if (!Array.isArray(incomingSlides)) return { ...slide, copyColor: DEFAULT_COPY_COLOR };
    const match = incomingSlides.find(
      (item) => item && typeof item === "object" && (item as PitchSlide).id === slide.id
    ) as PitchSlide | undefined;
    if (!match) return { ...slide, copyColor: fallbackColor };
    const ownColor = typeof match.copyColor === "string" ? safeCopyColor(match.copyColor) : fallbackColor;
    return {
      ...slide,
      image: safeImage(match.image, slide.image),
      copyColor: ownColor,
      blocks: Array.isArray(match.blocks)
        ? slide.blocks.map((block, index) => overlayBlock(block, match.blocks[index]))
        : slide.blocks,
    };
  });
  return { slides: nextSlides, copyColor: fallbackColor };
}

export async function resolveSongGardenPitch(): Promise<SongGardenPitch> {
  const stored = await readWorkspaceSettings({ skipCache: true });
  return applyStoredCopy(stored.settings.songGarden);
}
