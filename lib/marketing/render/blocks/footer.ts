import type { EmailSection } from "../../document/types";
import { escapeHtml, escapePreservingTokens } from "../html";
import { propString, sectionColors, wrapSection, type RenderedSection, type SectionContext } from "../section";

export function renderFooter(section: EmailSection, ctx: SectionContext): RenderedSection | { error: string } {
  if (section.props.showUnsubscribe === false) {
    return { error: "footer must include an unsubscribe link" };
  }
  const colors = sectionColors(ctx.tokens, section);
  const company = propString(section.props, "companyName") || ctx.companyName;
  const address = propString(section.props, "physicalAddress") || ctx.physicalAddress;
  const warnings = colors.warning ? [colors.warning] : [];
  if (!address.trim()) warnings.push("physical address is empty");
  const small = ctx.tokens.type.small;
  const eyebrow = ctx.tokens.type.eyebrow;
  const companyLine = company.trim()
    ? `<div style="font-size:${eyebrow.size}px;font-weight:${eyebrow.weight};letter-spacing:${eyebrow.tracking ?? 3.4}px;text-transform:uppercase;">${escapePreservingTokens(company)}</div>`
    : "";
  const addressLine = address.trim()
    ? `<div style="margin-top:8px;font-size:${small.size}px;font-weight:400;letter-spacing:0;text-transform:none;">${escapePreservingTokens(address)}</div>`
    : "";
  const inner = `<mj-divider border-color="${ctx.tokens.colors.brand}" border-width="1px" padding="0 0 16px 0" /><mj-text align="left" font-family="${ctx.tokens.fonts.ui}" font-size="${small.size}px" line-height="${small.lineHeight}" color="${ctx.tokens.colors.muted}" padding="0">${companyLine}${addressLine}<div style="margin-top:10px;"><a href="{{unsubscribe_url}}" style="color:${escapeHtml(ctx.tokens.colors.link)};text-decoration:underline;">Unsubscribe</a></div></mj-text>`;
  return {
    mjml: wrapSection(section, ctx.tokens, `<mj-column width="${ctx.tokens.contentWidth}px">${inner}</mj-column>`, colors),
    text: [company, address, "Unsubscribe: {{unsubscribe_url}}"].filter(Boolean).join("\n"),
    links: [{ url: "{{unsubscribe_url}}", label: "Unsubscribe" }],
    warnings,
  };
}
