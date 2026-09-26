import type { EmailSection } from "../../document/types";
import { escapePreservingTokens } from "../html";
import { propString, sectionColors, trackingAttr, wrapSection, type RenderedSection, type SectionContext } from "../section";

export function renderLargeStatement(section: EmailSection, ctx: SectionContext): RenderedSection {
  const colors = sectionColors(ctx.tokens, section);
  const align = section.align === "center" ? "center" : "left";
  const eyebrow = propString(section.props, "eyebrow");
  const text = propString(section.props, "text");
  const type = ctx.tokens.type;
  const parts: string[] = [];
  if (eyebrow) {
    parts.push(
      `<mj-text align="${align}" font-family="${ctx.tokens.fonts.ui}" font-size="${type.eyebrow.size}px" font-weight="${type.eyebrow.weight}" letter-spacing="${type.eyebrow.tracking ?? 1.4}px" text-transform="uppercase" color="${ctx.tokens.colors.brand}" padding="0 0 12px 0">${escapePreservingTokens(eyebrow)}</mj-text>`
    );
  }
  if (text) {
    parts.push(
      `<mj-text align="${align}" font-family="${ctx.tokens.fonts.heading}" font-size="${type.statement.size}px" font-weight="${type.statement.weight}" line-height="${type.statement.lineHeight}"${trackingAttr(type.statement)} color="${colors.color}" padding="0">${escapePreservingTokens(text)}</mj-text>`
    );
  }
  return {
    mjml: wrapSection(section, ctx.tokens, `<mj-column width="${ctx.tokens.contentWidth}px">${parts.join("")}</mj-column>`, colors),
    text: [eyebrow, text].filter(Boolean).join("\n"),
    links: [],
    warnings: colors.warning ? [colors.warning] : [],
  };
}
