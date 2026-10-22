import type { EmailSection } from "../../document/types";
import { escapePreservingTokens } from "../html";
import { propString, sectionColors, trackingAttr, wrapSection, type RenderedSection, type SectionContext } from "../section";

export function renderPullQuote(section: EmailSection, ctx: SectionContext): RenderedSection {
  const colors = sectionColors(ctx.tokens, section);
  const align = section.align === "center" ? "center" : "left";
  const quote = propString(section.props, "quote");
  const attribution = propString(section.props, "attribution");
  const type = ctx.tokens.type;
  const quoteColor = section.background === "brand" ? colors.color : ctx.tokens.colors.brand;
  const parts: string[] = [];
  if (quote) {
    parts.push(
      `<mj-text align="${align}" font-family="${ctx.tokens.fonts.heading}" font-size="${type.statement.size}px" font-weight="${type.statement.weight}" line-height="${type.statement.lineHeight}"${trackingAttr(type.statement)} color="${quoteColor}" padding="0">${escapePreservingTokens(quote)}</mj-text>`
    );
  }
  if (attribution) {
    parts.push(
      `<mj-text align="${align}" font-family="${ctx.tokens.fonts.ui}" font-size="${type.eyebrow.size}px" font-weight="${type.eyebrow.weight}" letter-spacing="${type.eyebrow.tracking ?? 3.4}px" text-transform="uppercase" line-height="${type.small.lineHeight}" color="${ctx.tokens.colors.muted}" padding="12px 0 0 0">${escapePreservingTokens(attribution)}</mj-text>`
    );
  }
  return {
    mjml: wrapSection(section, ctx.tokens, `<mj-column width="${ctx.tokens.contentWidth}px">${parts.join("")}</mj-column>`, colors),
    text: [quote, attribution].filter(Boolean).join("\n"),
    links: [],
    warnings: colors.warning ? [colors.warning] : [],
  };
}
