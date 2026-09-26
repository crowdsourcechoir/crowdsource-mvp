import type { EmailSection } from "../../document/types";
import { escapePreservingTokens } from "../html";
import { propString, sectionColors, wrapSection, type RenderedSection, type SectionContext } from "../section";

export function renderPullQuote(section: EmailSection, ctx: SectionContext): RenderedSection {
  const colors = sectionColors(ctx.tokens, section);
  const align = section.align === "center" ? "center" : "left";
  const quote = propString(section.props, "quote");
  const attribution = propString(section.props, "attribution");
  const type = ctx.tokens.type;
  const parts: string[] = [];
  if (quote) {
    parts.push(
      `<mj-text align="${align}" font-family="${ctx.tokens.fonts.heading}" font-size="${type.heading.size}px" font-weight="${type.heading.weight}" line-height="${type.heading.lineHeight}" font-style="italic" color="${colors.color}" padding="0">${escapePreservingTokens(quote)}</mj-text>`
    );
  }
  if (attribution) {
    parts.push(
      `<mj-text align="${align}" font-family="${ctx.tokens.fonts.ui}" font-size="${type.small.size}px" line-height="${type.small.lineHeight}" color="${ctx.tokens.colors.muted}" padding="12px 0 0 0">${escapePreservingTokens(attribution)}</mj-text>`
    );
  }
  return {
    mjml: wrapSection(section, ctx.tokens, `<mj-column width="${ctx.tokens.contentWidth}px">${parts.join("")}</mj-column>`, colors),
    text: [quote, attribution].filter(Boolean).join("\n"),
    links: [],
    warnings: colors.warning ? [colors.warning] : [],
  };
}
