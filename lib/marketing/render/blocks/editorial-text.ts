import type { EmailSection } from "../../document/types";
import { escapePreservingTokens } from "../html";
import { inlineDocumentToHtml, inlineToPlainText, plainTextToHtml } from "../inline";
import { propString, sectionColors, wrapSection, type RenderedSection, type SectionContext } from "../section";

export function renderEditorialText(section: EmailSection, ctx: SectionContext): RenderedSection {
  const colors = sectionColors(ctx.tokens, section);
  const align = section.align === "center" ? "center" : "left";
  const heading = propString(section.props, "heading");
  const text = propString(section.props, "text");
  const bodyHtml = text
    ? plainTextToHtml(text)
    : inlineDocumentToHtml(section.props.body, ctx.tokens.colors.link);
  const bodyText = text || inlineToPlainText(section.props.body);
  const type = ctx.tokens.type;
  const parts: string[] = [];
  if (heading) {
    parts.push(
      `<mj-text align="${align}" font-family="${ctx.tokens.fonts.heading}" font-size="${type.heading.size}px" font-weight="${type.heading.weight}" line-height="${type.heading.lineHeight}" color="${colors.color}" padding="0 0 8px 0">${escapePreservingTokens(heading)}</mj-text>`
    );
  }
  if (bodyHtml) {
    parts.push(
      `<mj-text align="${align}" font-family="${ctx.tokens.fonts.body}" font-size="${type.body.size}px" font-weight="${type.body.weight}" line-height="${type.body.lineHeight}" color="${colors.color}" padding="0">${bodyHtml}</mj-text>`
    );
  }
  return {
    mjml: wrapSection(
      section,
      ctx.tokens,
      `<mj-column width="${ctx.tokens.contentWidth}px">${parts.join("")}</mj-column>`,
      colors
    ),
    text: [heading, bodyText].filter(Boolean).join("\n"),
    links: [],
    warnings: colors.warning ? [colors.warning] : [],
  };
}
