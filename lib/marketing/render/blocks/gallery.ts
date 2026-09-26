import type { EmailSection, ImageRef } from "../../document/types";
import { escapeHtml } from "../html";
import { sectionColors, wrapSection, type RenderedSection, type SectionContext } from "../section";
import { imageWidth } from "../tokens";

function imagesOf(props: Record<string, unknown>): ImageRef[] {
  if (!Array.isArray(props.images)) return [];
  return props.images.flatMap((image) => {
    if (!image || typeof image !== "object") return [];
    const record = image as { url?: unknown; alt?: unknown; ratio?: unknown; assetId?: unknown };
    if (typeof record.url !== "string" || !record.url.trim()) return [];
    const ratio = record.ratio === "portrait" || record.ratio === "square" || record.ratio === "landscape" ? record.ratio : "square";
    return [
      {
        assetId: typeof record.assetId === "string" ? record.assetId : null,
        url: record.url.trim(),
        alt: typeof record.alt === "string" ? record.alt : "",
        ratio,
      },
    ];
  });
}

export function renderGallery(section: EmailSection, ctx: SectionContext): RenderedSection {
  const colors = sectionColors(ctx.tokens, section);
  const images = imagesOf(section.props).slice(0, 3);
  const warnings = colors.warning ? [colors.warning] : [];
  if (images.length === 0) warnings.push("gallery needs an image");
  const width = Math.floor(ctx.tokens.contentWidth / Math.max(images.length, 1));
  const columns = images
    .map((image) => {
      const imageWidthPx = Math.min(imageWidth(ctx.tokens, image.ratio), width);
      return `<mj-column width="${width}px"><mj-image src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" width="${imageWidthPx}px" fluid-on-mobile="true" padding="0" /></mj-column>`;
    })
    .join("");
  return {
    mjml: wrapSection(section, ctx.tokens, columns, colors),
    text: images.map((image) => image.alt).filter(Boolean).join("\n"),
    links: [],
    warnings,
  };
}
