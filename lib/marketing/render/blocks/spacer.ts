import type { EmailSection } from "../../document/types";
import { sectionColors, type RenderedSection, type SectionContext } from "../section";

export function renderSpacer(section: EmailSection, ctx: SectionContext): RenderedSection {
  const colors = sectionColors(ctx.tokens, section);
  const pad = ctx.tokens.spacing[section.spacing];
  const hidden = section.hideOnMobile ? ' css-class="hide-on-mobile"' : "";
  const mjml = `<mj-section background-color="${colors.background}" padding="${pad}px 20px"${hidden}><mj-column><mj-spacer height="1px" /></mj-column></mj-section>`;
  return { mjml, text: "", links: [], warnings: colors.warning ? [colors.warning] : [] };
}
