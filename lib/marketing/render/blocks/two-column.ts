import type { EmailSection } from "../../document/types";
import { escapePreservingTokens } from "../html";
import { plainTextToHtml } from "../inline";
import { propString, sectionColors, trackingAttr, wrapSection, type RenderedSection, type SectionContext } from "../section";

function column(heading: string, text: string, width: number, ctx: SectionContext, color: string): string {
  const parts: string[] = [];
  if (heading) {
    parts.push(
      `<mj-text font-family="${ctx.tokens.fonts.heading}" font-size="${ctx.tokens.type.heading.size}px" font-weight="${ctx.tokens.type.heading.weight}" line-height="${ctx.tokens.type.heading.lineHeight}"${trackingAttr(ctx.tokens.type.heading)} color="${color}" padding="0 0 8px 0">${escapePreservingTokens(heading)}</mj-text>`
    );
  }
  const html = plainTextToHtml(text);
  if (html) {
    parts.push(
      `<mj-text font-family="${ctx.tokens.fonts.body}" font-size="${ctx.tokens.type.body.size}px" line-height="${ctx.tokens.type.body.lineHeight}" color="${color}" padding="0">${html}</mj-text>`
    );
  }
  return `<mj-column width="${width}px">${parts.join("")}</mj-column>`;
}

export function renderTwoColumn(section: EmailSection, ctx: SectionContext): RenderedSection {
  const colors = sectionColors(ctx.tokens, section);
  const width = Math.floor(ctx.tokens.contentWidth / 2);
  const leftHeading = propString(section.props, "leftHeading");
  const leftText = propString(section.props, "leftText");
  const rightHeading = propString(section.props, "rightHeading");
  const rightText = propString(section.props, "rightText");
  return {
    mjml: wrapSection(
      section,
      ctx.tokens,
      `${column(leftHeading, leftText, width, ctx, colors.color)}${column(rightHeading, rightText, width, ctx, colors.color)}`,
      colors
    ),
    text: [leftHeading, leftText, rightHeading, rightText].filter(Boolean).join("\n"),
    links: [],
    warnings: colors.warning ? [colors.warning] : [],
  };
}
