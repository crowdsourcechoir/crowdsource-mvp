import type { EmailSection } from "../../document/types";
import { imageHref, imageRef, mjImage, sectionColors, wrapSection, type RenderedSection, type SectionContext } from "../section";
import { imageWidth } from "../tokens";

export function renderFullBleedImage(section: EmailSection, ctx: SectionContext): RenderedSection {
  const colors = sectionColors(ctx.tokens, section);
  const image = imageRef(section.props);
  const href = imageHref(image, section.props, "href");
  const warnings = colors.warning ? [colors.warning] : [];
  if (!image) {
    return { mjml: wrapSection(section, ctx.tokens, `<mj-column></mj-column>`, colors), text: "", links: [], warnings };
  }
  const width = Math.min(imageWidth(ctx.tokens, image.ratio), ctx.tokens.contentWidth);
  const mjml = wrapSection(
    section,
    ctx.tokens,
    `<mj-column width="${ctx.tokens.contentWidth}px">${mjImage({ src: image.url, alt: image.alt, width, href })}</mj-column>`,
    colors
  );
  return {
    mjml,
    text: [image.alt, href].filter(Boolean).join("\n"),
    links: href ? [{ url: href, label: image.alt || href }] : [],
    warnings,
  };
}
