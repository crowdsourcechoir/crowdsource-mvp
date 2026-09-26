import type { EmailSection } from "../../document/types";
import { escapeHtml, escapePreservingTokens, safeHref } from "../html";
import { imageRef, mjButton, propString, sectionColors, trackingAttr, wrapSection, type RenderedSection, type SectionContext } from "../section";
import { imageWidth } from "../tokens";

function pick(override: string, fallback: string | null | undefined): string {
  return override.trim() || fallback || "";
}

export function renderEvent(section: EmailSection, ctx: SectionContext): RenderedSection {
  const colors = sectionColors(ctx.tokens, section);
  const resolved = ctx.event;
  const title = pick(propString(section.props, "title"), resolved?.title) || "Event";
  const description = pick(propString(section.props, "description"), resolved?.description);
  const venue = pick(propString(section.props, "venue"), resolved?.venue);
  const date = pick(propString(section.props, "date"), resolved?.date);
  const href = safeHref(pick(propString(section.props, "href"), resolved?.url));
  const label = pick(propString(section.props, "ctaLabel"), resolved?.ctaText) || "Open event";
  const image = imageRef(section.props) ?? (resolved?.heroImage ? { assetId: null, url: resolved.heroImage, alt: title, ratio: "landscape" as const } : null);
  const warnings = colors.warning ? [colors.warning] : [];
  const parts: string[] = [];
  if (image) {
    const width = Math.min(imageWidth(ctx.tokens, image.ratio), ctx.tokens.contentWidth);
    parts.push(
      `<mj-image src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" width="${width}px" fluid-on-mobile="true" padding="0 0 12px 0" />`
    );
  }
  parts.push(
    `<mj-text font-family="${ctx.tokens.fonts.ui}" font-size="${ctx.tokens.type.eyebrow.size}px" font-weight="${ctx.tokens.type.eyebrow.weight}" letter-spacing="${ctx.tokens.type.eyebrow.tracking ?? 3.4}px" text-transform="uppercase" color="${ctx.tokens.colors.brand}" padding="0 0 8px 0">Bloom</mj-text>`
  );
  parts.push(
    `<mj-text font-family="${ctx.tokens.fonts.heading}" font-size="${ctx.tokens.type.heading.size}px" font-weight="${ctx.tokens.type.heading.weight}" line-height="${ctx.tokens.type.heading.lineHeight}"${trackingAttr(ctx.tokens.type.heading)} color="${colors.color}" padding="0">${escapePreservingTokens(title)}</mj-text>`
  );
  const meta = [date, venue].filter(Boolean).join(" · ");
  if (meta) {
    parts.push(
      `<mj-text font-size="${ctx.tokens.type.small.size}px" color="${ctx.tokens.colors.muted}" padding="6px 0 0 0">${escapePreservingTokens(meta)}</mj-text>`
    );
  }
  if (description) {
    parts.push(
      `<mj-text font-size="${ctx.tokens.type.body.size}px" line-height="${ctx.tokens.type.body.lineHeight}" color="${colors.color}" padding="10px 0 0 0">${escapePreservingTokens(description)}</mj-text>`
    );
  }
  if (href) {
    parts.push(
      mjButton({ align: "left", href, label, tokens: ctx.tokens, padding: "16px 0 0 0" })
    );
  } else {
    warnings.push("event href must be http(s) or mailto");
  }
  return {
    mjml: wrapSection(section, ctx.tokens, `<mj-column width="${ctx.tokens.contentWidth}px">${parts.join("")}</mj-column>`, colors),
    text: [title, meta, description, href ? `${label}: ${href}` : ""].filter(Boolean).join("\n"),
    links: href ? [{ url: href, label }] : [],
    warnings,
  };
}
