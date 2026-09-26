import type { EmailSection } from "../../document/types";
import { escapeHtml, escapePreservingTokens, safeHref } from "../html";
import { plainTextToHtml } from "../inline";
import { imageRef, mjButton, propString, sectionColors, trackingAttr, wrapSection, type RenderedSection, type SectionContext } from "../section";
import { imageWidth } from "../tokens";

export function renderSongGardenInvitation(section: EmailSection, ctx: SectionContext): RenderedSection {
  const colors = sectionColors(ctx.tokens, section);
  const align = section.align === "center" ? "center" : "left";
  const heading = propString(section.props, "heading");
  const text = propString(section.props, "text");
  const label = propString(section.props, "ctaLabel");
  const href = safeHref(propString(section.props, "ctaHref"));
  const image = imageRef(section.props);
  const warnings = colors.warning ? [colors.warning] : [];
  const parts: string[] = [];
  if (image) {
    const width = Math.min(imageWidth(ctx.tokens, image.ratio), ctx.tokens.contentWidth);
    parts.push(
      `<mj-image src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" width="${width}px" fluid-on-mobile="true" padding="0 0 16px 0" align="${align}" />`
    );
  }
  if (heading) {
    parts.push(
      `<mj-text align="${align}" font-family="${ctx.tokens.fonts.heading}" font-size="${ctx.tokens.type.title.size}px" font-weight="${ctx.tokens.type.title.weight}" line-height="${ctx.tokens.type.title.lineHeight}"${trackingAttr(ctx.tokens.type.title)} color="${colors.color}" padding="0">${escapePreservingTokens(heading)}</mj-text>`
    );
  }
  const body = plainTextToHtml(text);
  if (body) {
    parts.push(
      `<mj-text align="${align}" font-family="${ctx.tokens.fonts.body}" font-size="${ctx.tokens.type.body.size}px" line-height="${ctx.tokens.type.body.lineHeight}" color="${colors.color}" padding="10px 0 0 0">${body}</mj-text>`
    );
  }
  if (label && href) {
    parts.push(mjButton({ align, href, label, tokens: ctx.tokens, padding: "16px 0 0 0" }));
  } else if (label) {
    warnings.push("song garden button href must be http(s) or mailto");
  }
  const links = href && label ? [{ url: href, label }] : [];
  return {
    mjml: wrapSection(section, ctx.tokens, `<mj-column width="${ctx.tokens.contentWidth}px">${parts.join("")}</mj-column>`, colors),
    text: [heading, text, label && href ? `${label}: ${href}` : ""].filter(Boolean).join("\n"),
    links,
    warnings,
  };
}
