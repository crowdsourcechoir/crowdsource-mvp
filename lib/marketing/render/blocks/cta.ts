import type { EmailSection } from "../../document/types";
import { safeHref } from "../html";
import { mjButton, propString, sectionColors, wrapSection, type RenderedSection, type SectionContext } from "../section";

export function renderCta(section: EmailSection, ctx: SectionContext): RenderedSection {
  const colors = sectionColors(ctx.tokens, section);
  const align = section.align === "center" ? "center" : "left";
  const label = propString(section.props, "label") || "Learn more";
  const href = safeHref(propString(section.props, "href"));
  const warnings = colors.warning ? [colors.warning] : [];
  const outline = section.props.style === "outline";
  const inner = href ? mjButton({ align, href, label, tokens: ctx.tokens, outline }) : "";
  if (!href) warnings.push("cta href must be http(s) or mailto");
  return {
    mjml: wrapSection(section, ctx.tokens, `<mj-column width="${ctx.tokens.contentWidth}px">${inner}</mj-column>`, colors),
    text: href ? `${label}: ${href}` : label,
    links: href ? [{ url: href, label }] : [],
    warnings,
  };
}
