import type { EmailSection } from "../../document/types";
import { escapeHtml, escapePreservingTokens, safeHref } from "../html";
import { propString, sectionColors, wrapSection, type RenderedSection, type SectionContext } from "../section";

export function renderCta(section: EmailSection, ctx: SectionContext): RenderedSection {
  const colors = sectionColors(ctx.tokens, section);
  const align = section.align === "center" ? "center" : "left";
  const label = propString(section.props, "label") || "Learn more";
  const href = safeHref(propString(section.props, "href"));
  const warnings = colors.warning ? [colors.warning] : [];
  const outline = section.props.style === "outline";
  const button = ctx.tokens.button;
  const background = outline ? "transparent" : ctx.tokens.colors.brand;
  const color = outline ? ctx.tokens.colors.link : ctx.tokens.colors.brandInk;
  const border = outline ? ` border="1px solid ${ctx.tokens.colors.link}"` : "";
  const inner = href
    ? `<mj-button align="${align}" href="${escapeHtml(href)}" background-color="${background}" color="${color}"${border} font-family="${ctx.tokens.fonts.ui}" font-size="${button.fontSize}px" font-weight="700" border-radius="${ctx.tokens.radii.button}px" inner-padding="${button.paddingY}px ${button.paddingX}px" padding="0">${escapePreservingTokens(label)}</mj-button>`
    : "";
  if (!href) warnings.push("cta href must be http(s) or mailto");
  return {
    mjml: wrapSection(section, ctx.tokens, `<mj-column width="${ctx.tokens.contentWidth}px">${inner}</mj-column>`, colors),
    text: href ? `${label}: ${href}` : label,
    links: href ? [{ url: href, label }] : [],
    warnings,
  };
}
