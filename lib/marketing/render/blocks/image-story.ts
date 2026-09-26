import type { EmailSection } from "../../document/types";
import { escapeHtml, escapePreservingTokens, safeHref } from "../html";
import { inlineDocumentToHtml, inlineToPlainText, plainTextToHtml } from "../inline";
import { imageRef, mjButton, propString, sectionColors, trackingAttr, type RenderedSection, type SectionContext } from "../section";
import { imageWidth } from "../tokens";

export function renderImageStory(section: EmailSection, ctx: SectionContext): RenderedSection {
  const colors = sectionColors(ctx.tokens, section);
  const image = imageRef(section.props);
  const heading = propString(section.props, "heading");
  const text = propString(section.props, "text");
  const bodyHtml = text ? plainTextToHtml(text) : inlineDocumentToHtml(section.props.body, ctx.tokens.colors.link);
  const bodyText = text || inlineToPlainText(section.props.body);
  const label = propString(section.props, "ctaLabel");
  const href = safeHref(propString(section.props, "ctaHref"));
  const warnings = colors.warning ? [colors.warning] : [];
  const imageColumn = image
    ? Math.min(imageWidth(ctx.tokens, image.ratio), Math.floor(ctx.tokens.contentWidth * 0.46))
    : 0;
  const textColumn = ctx.tokens.contentWidth - imageColumn;
  const position = section.props.imagePosition === "right" ? "right" : "left";
  const imageMjml = image
    ? `<mj-column width="${imageColumn}px"><mj-image src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" width="${imageColumn}px" fluid-on-mobile="true" padding="0" /></mj-column>`
    : "";
  const textParts: string[] = [];
  if (heading) {
    textParts.push(
      `<mj-text font-family="${ctx.tokens.fonts.heading}" font-size="${ctx.tokens.type.heading.size}px" font-weight="${ctx.tokens.type.heading.weight}" line-height="${ctx.tokens.type.heading.lineHeight}"${trackingAttr(ctx.tokens.type.heading)} color="${colors.color}" padding="0 0 8px 0">${escapePreservingTokens(heading)}</mj-text>`
    );
  }
  if (bodyHtml) {
    textParts.push(
      `<mj-text font-family="${ctx.tokens.fonts.body}" font-size="${ctx.tokens.type.body.size}px" line-height="${ctx.tokens.type.body.lineHeight}" color="${colors.color}" padding="0">${bodyHtml}</mj-text>`
    );
  }
  if (label && href) {
    textParts.push(
      mjButton({ align: "left", href, label, tokens: ctx.tokens, padding: "12px 0 0 0" })
    );
  } else if (label) {
    warnings.push("image story button href must be http(s) or mailto");
  }
  const textMjml = `<mj-column width="${textColumn || ctx.tokens.contentWidth}px">${textParts.join("")}</mj-column>`;
  const direction = position === "right" ? "rtl" : "ltr";
  const hidden = section.hideOnMobile ? ' css-class="hide-on-mobile"' : "";
  const pad = ctx.tokens.spacing[section.spacing];
  const mjml = `<mj-section background-color="${colors.background}" padding="${pad}px 20px" direction="${direction}"${hidden}>${imageMjml}${textMjml}</mj-section>`;
  return {
    mjml,
    text: [heading, bodyText, label && href ? `${label}: ${href}` : ""].filter(Boolean).join("\n"),
    links: href && label ? [{ url: href, label }] : [],
    warnings,
  };
}
