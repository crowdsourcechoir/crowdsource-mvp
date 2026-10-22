import type { EmailSection } from "../../document/types";
import { sectionColors, wrapSection, type RenderedSection, type SectionContext } from "../section";

export function renderDivider(section: EmailSection, ctx: SectionContext): RenderedSection {
  const colors = sectionColors(ctx.tokens, section);
  const mjml = wrapSection(
    section,
    ctx.tokens,
    `<mj-column width="${ctx.tokens.contentWidth}px"><mj-divider border-color="${ctx.tokens.colors.brand}" border-width="1px" padding="0" /></mj-column>`,
    colors
  );
  return { mjml, text: "", links: [], warnings: colors.warning ? [colors.warning] : [] };
}
