import { DEFAULT_BOOK_URL } from "./bookUrl";
import { EMAIL_SIGNATURE_HTML, ensureEmailSignature, stripEmailSignature } from "./signature";

export type OutboundEmailContent = {
  plain: string;
  html: string;
};

const TOKEN_PREFIX = "\u0000CSC";
const TOKEN_SUFFIX = "\u0000";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Accept http(s) only. Bare www./domain values get https. */
export function sanitizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^(https?:\/\/)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function trimUrlPunctuation(raw: string): { url: string; trailing: string } {
  const match = raw.match(/^(.*?)([),.;:!?]+)$/);
  if (!match) return { url: raw, trailing: "" };
  // Keep a trailing slash / balanced closing paren that belongs to the URL.
  if (match[2] === "/" || (match[2] === ")" && (match[1].match(/\(/g)?.length ?? 0) > (match[1].match(/\)/g)?.length ?? 0))) {
    return { url: raw, trailing: "" };
  }
  return { url: match[1], trailing: match[2] };
}

function markdownLinkReplacer(text: string, href: string): string | null {
  const safe = sanitizeHttpUrl(href);
  if (!safe || !text.trim()) return null;
  return `<a href="${escapeHtml(safe)}" style="color:#1a73e8;text-decoration:underline">${escapeHtml(text.trim())}</a>`;
}

function urlLinkReplacer(raw: string): { html: string; trailing: string } | null {
  const { url, trailing } = trimUrlPunctuation(raw);
  const safe = sanitizeHttpUrl(url);
  if (!safe) return null;
  const label = escapeHtml(url);
  return {
    html: `<a href="${escapeHtml(safe)}" style="color:#1a73e8;text-decoration:underline">${label}</a>`,
    trailing,
  };
}

/**
 * Turns `[label](https://…)` and bare http(s)/www URLs into `<a>` tags. Everything else is
 * escaped. Safe to feed to Gmail as text/html.
 */
export function renderEmailBodyHtml(body: string): string {
  const source = stripEmailSignature(body);
  const tokens: string[] = [];
  const stash = (html: string): string => {
    const token = `${TOKEN_PREFIX}${tokens.length}${TOKEN_SUFFIX}`;
    tokens.push(html);
    return token;
  };

  let next = source.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (full, label: string, href: string) => {
    const html = markdownLinkReplacer(label, href);
    return html ? stash(html) : full;
  });

  next = next.replace(/\bhttps?:\/\/[^\s<]+|\bwww\.[^\s<]+/gi, (raw) => {
    const linked = urlLinkReplacer(raw);
    if (!linked) return raw;
    return stash(linked.html) + linked.trailing;
  });

  let html = escapeHtml(next).replace(/\r\n/g, "\n").replace(/\n/g, "<br>\n");
  tokens.forEach((value, index) => {
    html = html.replace(escapeHtml(`${TOKEN_PREFIX}${index}${TOKEN_SUFFIX}`), value);
  });
  return html;
}

export function wrapOutreachEmailHtml(innerHtml: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111111">${innerHtml}<br>\n<br>\n${EMAIL_SIGNATURE_HTML}</div>`;
}

function markdownLinksToPlain(body: string): string {
  return body.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (full, label: string, href: string) => {
    const safe = sanitizeHttpUrl(href);
    if (!safe) return full;
    const text = label.trim() || safe;
    return text === safe ? safe : `${text} (${safe})`;
  });
}

/** Plain + HTML payload for Gmail send, clipboard copy, and mailto fallback. */
export function prepareOutboundEmail(body: string): OutboundEmailContent {
  const unsigned = stripEmailSignature(body);
  const plain = ensureEmailSignature(markdownLinksToPlain(unsigned));
  const html = wrapOutreachEmailHtml(renderEmailBodyHtml(unsigned));
  return { plain, html };
}

export function insertMarkdownLink(
  body: string,
  start: number,
  end: number,
  url: string,
  label?: string
): { body: string; cursor: number } | { error: string } {
  const safe = sanitizeHttpUrl(url);
  if (!safe) return { error: "Enter a valid http(s) URL." };
  const from = Math.max(0, Math.min(start, end, body.length));
  const to = Math.max(0, Math.min(Math.max(start, end), body.length));
  const selected = body.slice(from, to);
  const text = (label ?? selected).trim() || safe;
  let snippet = `[${text}](${safe})`;
  if (from > 0 && !/\s/.test(body[from - 1])) snippet = ` ${snippet}`;
  if (to < body.length && !/\s/.test(body[to])) snippet = `${snippet} `;
  const next = `${body.slice(0, from)}${snippet}${body.slice(to)}`;
  return { body: next, cursor: from + snippet.length };
}

export function bookPageUrl(): string {
  return DEFAULT_BOOK_URL;
}
