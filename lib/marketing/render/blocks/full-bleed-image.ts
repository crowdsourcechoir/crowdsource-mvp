import type { EmailSection } from "../../document/types";
import { escapeHtml, safeHref } from "../html";
import { imageRef, propString, sectionColors, wrapSection, type RenderedSection, type SectionContext } from "../section";
import { imageWidth } from "../tokens";

export function renderFullBleedImage(section: EmailSection, ctx: SectionContext): RenderedSection {
  const colors = sectionColors(ctx.tokens, section);
  const image = imageRef(section.props);
  const href = safeHref(propString(section.props, "href"));
  const warnings = colors.warning ? [colors.warning] : [];
  if (!image) {
    return { mjml: wrapSection(section, ctx.tokens, `<mj-column></mj-column>`, colors), text: "", links: [], warnings };
  }
  const width = Math.min(imageWidth(ctx.tokens, image.ratio), ctx.tokens.contentWidth);
  const linkAttr = href ? ` href="${escapeHtml(href)}"` : "";
  const mjml = wrapSection(
    section,
    ctx.tokens,
    `<mj-column width="${ctx.tokens.contentWidth}px"><mj-image src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" width="${width}px" fluid-on-mobile="true"${linkAttr} padding="0" /></mj-column>`,
    colors
  );
  return {
    mjml,
    text: image.alt,
    links: href ? [{ url: href, label: image.alt || href }] : [],
    warnings,
  };
}
