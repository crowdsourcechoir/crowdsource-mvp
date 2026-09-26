import type { EmailSection, ImageRatio, ImageRef } from "../document/types";
import { escapeHtml, escapePreservingTokens } from "./html";
import type { EventBlockData } from "./event-data";
import type { EmailDesignTokens, EmailTypeStyle } from "./tokens";

export type EmailLink = { url: string; label: string };

export type RenderedSection = {
  mjml: string;
  text: string;
  links: EmailLink[];
  warnings: string[];
};

export type SectionContext = {
  tokens: EmailDesignTokens;
  companyName: string;
  physicalAddress: string;
  event?: EventBlockData | null;
};

export function propString(props: Record<string, unknown>, key: string): string {
  const value = props[key];
  return typeof value === "string" ? value : "";
}

export function imageRef(props: Record<string, unknown>, key = "image"): ImageRef | null {
  const image = props[key];
  if (!image || typeof image !== "object") return null;
  const record = image as { url?: unknown; alt?: unknown; ratio?: unknown };
  if (typeof record.url !== "string" || !record.url.trim()) return null;
  const ratio: ImageRatio =
    record.ratio === "portrait" || record.ratio === "square" || record.ratio === "landscape" ? record.ratio : "landscape";
  return {
    assetId: null,
    url: record.url.trim(),
    alt: typeof record.alt === "string" ? record.alt : "",
    ratio,
  };
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function sectionColors(
  tokens: EmailDesignTokens,
  section: EmailSection
): { background: string; color: string; warning?: string } {
  if (section.background === "surface") return { background: tokens.colors.surface, color: tokens.colors.ink };
  if (section.background === "brand") return { background: tokens.colors.brand, color: tokens.colors.brandInk };
  if (section.background === "ink") return { background: tokens.colors.ink, color: tokens.colors.canvas };
  if (section.background === "custom") {
    const hex = section.customBackground ?? "";
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      return { background: tokens.colors.canvas, color: tokens.colors.ink, warning: "custom background must be #rrggbb" };
    }
    const light = luminance(hex);
    const color = light > 0.45 ? tokens.colors.canvas : tokens.colors.ink;
    const warning = light > 0.25 && light < 0.75 ? "custom background may be low contrast" : undefined;
    return { background: hex, color, warning };
  }
  return { background: tokens.colors.canvas, color: tokens.colors.ink };
}

export function trackingAttr(style: Pick<EmailTypeStyle, "tracking">): string {
  return style.tracking ? ` letter-spacing="${style.tracking}px"` : "";
}

export function mjButton(input: {
  align: "left" | "center";
  href: string;
  label: string;
  tokens: EmailDesignTokens;
  outline?: boolean;
  padding?: string;
}): string {
  const outline = input.outline === true;
  const background = outline ? "transparent" : input.tokens.colors.brand;
  const color = outline ? input.tokens.colors.link : input.tokens.colors.brandInk;
  const border = outline ? ` border="1px solid ${input.tokens.colors.link}"` : "";
  const button = input.tokens.button;
  return `<mj-button css-class="csc-btn" align="${input.align}" href="${escapeHtml(input.href)}" background-color="${escapeHtml(background)}" color="${escapeHtml(color)}"${border} font-family="${escapeHtml(input.tokens.fonts.ui)}" font-size="${button.fontSize}px" font-weight="700" border-radius="${input.tokens.radii.button}px" inner-padding="${button.paddingY}px ${button.paddingX}px" padding="${input.padding ?? "0"}">${escapePreservingTokens(input.label)}</mj-button>`;
}

export function wrapSection(section: EmailSection, tokens: EmailDesignTokens, inner: string, colors: { background: string }): string {
  const pad = tokens.spacing[section.spacing];
  const hidden = section.hideOnMobile ? ' css-class="hide-on-mobile"' : "";
  return `<mj-section background-color="${colors.background}" padding="${pad}px 20px"${hidden}>${inner}</mj-section>`;
}
