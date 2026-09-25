import type { EmailSection } from "../../document/types";
import { escapeHtml, escapePreservingTokens, safeHref } from "../html";
import { imageRef, propString, sectionColors, wrapSection, type RenderedSection, type SectionContext } from "../section";
import { imageWidth } from "../tokens";

export function renderHero(section: EmailSection, ctx: SectionContext): RenderedSection {
  const colors = sectionColors(ctx.tokens, section);
  const align = section.align === "center" ? "center" : "left";
  const eyebrow = propString(section.props, "eyebrow");
  const title = propString(section.props, "title");
  const subtitle = propString(section.props, "subtitle");
  const image = imageRef(section.props);
  const label = propString(section.props, "ctaLabel");
  const href = safeHref(propString(section.props, "ctaHref"));
  const warnings = colors.warning ? [colors.warning] : [];
  const links = href && label ? [{ url: href, label }] : [];
  const type = ctx.tokens.type;
  const parts: string[] = [];
  if (image) {
    const width = Math.min(imageWidth(ctx.tokens, image.ratio), ctx.tokens.contentWidth);
    parts.push(
      `<mj-image src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" width="${width}px" fluid-on-mobile="true" padding="0 0 16px 0" align="${align}" />`
    );
  }
  if (eyebrow) {
    parts.push(
      `<mj-text align="${align}" font-family="${escapeHtml(ctx.tokens.fonts.ui)}" font-size="${type.eyebrow.size}px" font-weight="${type.eyebrow.weight}" line-height="${type.eyebrow.lineHeight}" letter-spacing="${type.eyebrow.tracking ?? 1.4}px" text-transform="uppercase" color="${escapeHtml(ctx.tokens.colors.brand)}" padding="0 0 8px 0">${escapePreservingTokens(eyebrow)}</mj-text>`
    );
  }
  if (title) {
    parts.push(
      `<mj-text align="${align}" font-family="${escapeHtml(ctx.tokens.fonts.heading)}" font-size="${type.title.size}px" font-weight="${type.title.weight}" line-height="${type.title.lineHeight}" color="${escapeHtml(colors.color)}" padding="0">${escapePreservingTokens(title)}</mj-text>`
    );
  }
  if (subtitle) {
    parts.push(
      `<mj-text align="${align}" font-family="${escapeHtml(ctx.tokens.fonts.body)}" font-size="${type.body.size}px" line-height="${type.body.lineHeight}" color="${escapeHtml(ctx.tokens.colors.muted)}" padding="10px 0 0 0">${escapePreservingTokens(subtitle)}</mj-text>`
    );
  }
  if (label && href) {
    const button = ctx.tokens.button;
    parts.push(
      `<mj-button align="${align}" href="${escapeHtml(href)}" background-color="${escapeHtml(ctx.tokens.colors.brand)}" color="${escapeHtml(ctx.tokens.colors.brandInk)}" font-family="${escapeHtml(ctx.tokens.fonts.ui)}" font-size="${button.fontSize}px" font-weight="700" border-radius="${ctx.tokens.radii.button}px" inner-padding="${button.paddingY}px ${button.paddingX}px" padding="16px 0 0 0">${escapePreservingTokens(label)}</mj-button>`
    );
  } else if (label) {
    warnings.push("hero button href must be http(s) or mailto");
  }
  const mjml = wrapSection(
    section,
    ctx.tokens,
    `<mj-column width="${ctx.tokens.contentWidth}px">${parts.join("")}</mj-column>`,
    colors
  );
  return {
    mjml,
    text: [eyebrow, title, subtitle, label && href ? `${label}: ${href}` : ""].filter(Boolean).join("\n"),
    links,
    warnings,
  };
}
