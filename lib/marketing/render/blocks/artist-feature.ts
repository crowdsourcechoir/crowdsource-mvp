import type { EmailSection } from "../../document/types";
import { escapeHtml, escapePreservingTokens, safeHref } from "../html";
import { plainTextToHtml } from "../inline";
import { imageRef, propString, sectionColors, wrapSection, type RenderedSection, type SectionContext } from "../section";
import { imageWidth } from "../tokens";

export function renderArtistFeature(section: EmailSection, ctx: SectionContext): RenderedSection {
  const colors = sectionColors(ctx.tokens, section);
  const name = propString(section.props, "name");
  const role = propString(section.props, "role");
  const bio = plainTextToHtml(propString(section.props, "bio"));
  const href = safeHref(propString(section.props, "href"));
  const image = imageRef(section.props);
  const warnings = colors.warning ? [colors.warning] : [];
  const imageColumn = image ? Math.min(imageWidth(ctx.tokens, image.ratio), 200) : 0;
  const textWidth = ctx.tokens.contentWidth - imageColumn;
  const imageMjml = image
    ? `<mj-column width="${imageColumn}px"><mj-image src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt || name)}" width="${imageColumn}px" fluid-on-mobile="true" padding="0" /></mj-column>`
    : "";
  const parts: string[] = [];
  if (name) {
    const nameHtml = href
      ? `<a href="${escapeHtml(href)}" style="color:${colors.color};text-decoration:none;">${escapePreservingTokens(name)}</a>`
      : escapePreservingTokens(name);
    parts.push(
      `<mj-text font-family="${ctx.tokens.fonts.heading}" font-size="${ctx.tokens.type.heading.size}px" font-weight="${ctx.tokens.type.heading.weight}" color="${colors.color}" padding="0">${nameHtml}</mj-text>`
    );
  }
  if (role) {
    parts.push(
      `<mj-text font-family="${ctx.tokens.fonts.ui}" font-size="${ctx.tokens.type.small.size}px" color="${ctx.tokens.colors.muted}" padding="4px 0 8px 0">${escapePreservingTokens(role)}</mj-text>`
    );
  }
  if (bio) {
    parts.push(
      `<mj-text font-family="${ctx.tokens.fonts.body}" font-size="${ctx.tokens.type.body.size}px" line-height="${ctx.tokens.type.body.lineHeight}" color="${colors.color}" padding="0">${bio}</mj-text>`
    );
  }
  const links = href && name ? [{ url: href, label: name }] : [];
  return {
    mjml: wrapSection(section, ctx.tokens, `${imageMjml}<mj-column width="${textWidth}px">${parts.join("")}</mj-column>`, colors),
    text: [name, role, propString(section.props, "bio"), href].filter(Boolean).join("\n"),
    links,
    warnings,
  };
}
