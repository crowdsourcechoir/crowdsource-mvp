/**
 * Queue drafts start as plain text / markdown. Once Joel edits in TipTap we store
 * sanitized HTML so hyperlinks, lists, and inline styles survive Gmail send.
 * Unedited AI drafts stay markdown and still round-trip through the same helpers.
 */

const BULLET = String.raw`[-*•●◦▪·]|\u2022|\u25cf|\u25e6|\uf0b7|\u00b7`;
const UL_LINE = new RegExp(String.raw`^\s*(?:${BULLET})\s*(.*)$`, "i");
const OL_LINE = /^\s*(\d+)[.)]\s+(.*)$/;
const URL_RE = /https?:\/\/[^\s<]+|(?:www\.)?crowdsourcechoir\.com\/book/gi;

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripTagsKeepText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|tr|li)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function linkifyInline(escapedText: string): string {
  const placeholders: string[] = [];
  const stash = (html: string) => {
    const i = placeholders.length;
    placeholders.push(html);
    return `\u0000${i}\u0000`;
  };
  let s = escapedText.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, href) =>
    stash(`<a href="${href}" style="color:#1a73e8;text-decoration:underline">${label}</a>`)
  );
  s = s.replace(URL_RE, (raw) => {
    const trimmed = raw.replace(/[),.;:!?]+$/g, "");
    const trailing = raw.slice(trimmed.length);
    const href = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    return `${stash(`<a href="${escapeHtml(href)}" style="color:#1a73e8;text-decoration:underline">${escapeHtml(trimmed)}</a>`)}${trailing}`;
  });
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => placeholders[Number(i)]);
}

type Block =
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === "") {
      i += 1;
      continue;
    }
    const ulItems: string[] = [];
    while (i < lines.length) {
      const match = lines[i].match(UL_LINE);
      if (!match) break;
      ulItems.push(match[1].trim());
      i += 1;
    }
    if (ulItems.length) {
      blocks.push({ type: "ul", items: ulItems });
      continue;
    }
    const olItems: string[] = [];
    while (i < lines.length) {
      const match = lines[i].match(OL_LINE);
      if (!match) break;
      olItems.push(match[2].trim());
      i += 1;
    }
    if (olItems.length) {
      blocks.push({ type: "ol", items: olItems });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !UL_LINE.test(lines[i]) && !OL_LINE.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    if (para.length) blocks.push({ type: "p", lines: para });
  }
  return blocks;
}

function inlineEditor(text: string): string {
  return linkifyInline(escapeHtml(text)).replace(/\n/g, "<br>");
}

export function markdownToEditorHtml(markdown: string): string {
  const blocks = parseBlocks(markdown ?? "");
  if (!blocks.length) return "<p><br></p>";
  return blocks
    .map((block) => {
      if (block.type === "ul") {
        return `<ul>${block.items.map((item) => `<li>${inlineEditor(item)}</li>`).join("")}</ul>`;
      }
      if (block.type === "ol") {
        return `<ol>${block.items.map((item) => `<li>${inlineEditor(item)}</li>`).join("")}</ol>`;
      }
      const inner = block.lines.map((line) => inlineEditor(line)).join("<br>");
      return `<p>${inner || "<br>"}</p>`;
    })
    .join("");
}

export function markdownToEmailHtml(markdown: string): string {
  const blocks = parseBlocks(markdown ?? "");
  const inner = blocks
    .map((block) => {
      if (block.type === "ul") {
        const items = block.items.map((item) => `<li style="margin:0 0 4px 0">${linkifyInline(escapeHtml(item))}</li>`).join("");
        return `<ul style="margin:0 0 12px 0;padding-left:24px;list-style-type:disc">${items}</ul>`;
      }
      if (block.type === "ol") {
        const items = block.items.map((item) => `<li style="margin:0 0 4px 0">${linkifyInline(escapeHtml(item))}</li>`).join("");
        return `<ol style="margin:0 0 12px 0;padding-left:24px;list-style-type:decimal">${items}</ol>`;
      }
      const text = block.lines.map((line) => linkifyInline(escapeHtml(line))).join("<br>");
      return `<p style="margin:0 0 12px 0">${text || "&nbsp;"}</p>`;
    })
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222">${inner}</div>`;
}

function hrefToMarkdown(hrefRaw: string, labelRaw: string): string {
  const href = decodeHtmlEntities(hrefRaw).trim();
  const label = stripTagsKeepText(labelRaw) || href;
  if (!href) return label;
  if (!/^https?:\/\//i.test(href) && !href.startsWith("mailto:")) return label;
  return label === href || href.includes(label.replace(/^https?:\/\//, "")) ? href : `[${label}](${href})`;
}

function anchorsToMarkdown(html: string): string {
  return html.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) =>
    hrefToMarkdown(href, text)
  );
}

function listItemsFromHtml(inner: string, ordered: boolean): string {
  const items = Array.from(inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi));
  if (!items.length) {
    const text = stripTagsKeepText(inner);
    return text ? `${ordered ? "1. " : "- "}${text}` : "";
  }
  return items
    .map((match, index) => {
      const text = stripTagsKeepText(match[1]).replace(/\n+/g, " ").trim();
      return ordered ? `${index + 1}. ${text}` : `- ${text}`;
    })
    .join("\n");
}

/**
 * Serialize editor HTML (and pasted Word/Docs HTML) back to markdown lists + links.
 */
export function editorHtmlToMarkdown(html: string): string {
  if (!html) return "";
  let s = html.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
  s = anchorsToMarkdown(s);

  s = s.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => `\n${listItemsFromHtml(inner, false)}\n`);
  s = s.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => `\n${listItemsFromHtml(inner, true)}\n`);
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => `\n- ${stripTagsKeepText(inner).replace(/\n+/g, " ").trim()}\n`);

  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|h[1-6]|tr)>/gi, "\n");
  s = s.replace(/<(p|div|h[1-6]|tr)\b[^>]*>/gi, "");
  s = s.replace(/<[^>]+>/g, "");
  s = decodeHtmlEntities(s);
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

export function normalizeListPlainText(text: string): string {
  return (text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const ul = line.match(UL_LINE);
      if (ul) return `- ${ul[1].trim()}`;
      const ol = line.match(OL_LINE);
      if (ol) return `${Number(ol[1])}. ${ol[2].trim()}`;
      return line.replace(/\s+$/g, "");
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasMarkdownList(text: string): boolean {
  return /(?:^|\n)\s*(?:- |\d+\. )/m.test(text);
}

/**
 * Convert pasted HTML (Google Docs, Word, Gmail) into markdown, falling back to
 * plain text when the HTML dropped the list markers.
 */
export function clipboardHtmlToMarkdown(html: string): string {
  let cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<meta[^>]*>/gi, "");

  if (/mso-list/i.test(cleaned)) {
    cleaned = cleaned.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (full, inner) => {
      if (!/mso-list/i.test(full)) return full;
      const text = stripTagsKeepText(inner);
      const ul = text.match(UL_LINE);
      if (ul) return `<li>${escapeHtml(ul[1].trim())}</li>`;
      const ol = text.match(OL_LINE);
      if (ol) return `<li data-ol="1">${escapeHtml(ol[2].trim())}</li>`;
      return `<li>${escapeHtml(text.replace(/^[\s\d.)•●◦▪·\u2022\u25cf\u00b7-]+/, "").trim())}</li>`;
    });
    cleaned = cleaned.replace(/(?:<li\b[\s\S]*?<\/li>\s*)+/gi, (run) =>
      /data-ol="1"/.test(run) ? `<ol>${run}</ol>` : `<ul>${run}</ul>`
    );
  }

  return editorHtmlToMarkdown(cleaned);
}

export function pasteToMarkdown(html: string | null | undefined, plain: string | null | undefined): string {
  const plainNorm = normalizeListPlainText(plain || "");
  if (html && html.trim()) {
    const fromHtml = clipboardHtmlToMarkdown(html);
    if (hasMarkdownList(fromHtml)) return fromHtml;
    if (hasMarkdownList(plainNorm) || /(?:^|\n)\s*[•●◦]/.test(plain || "")) return plainNorm;
    return fromHtml || plainNorm;
  }
  return plainNorm;
}

const ALLOWED_TAGS = new Set(["p", "br", "div", "ul", "ol", "li", "a", "strong", "b", "em", "i", "u", "s", "blockquote", "h1", "h2", "h3", "span"]);

function attrValue(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? decodeHtmlEntities(match[1]).trim() : null;
}

function safeHref(raw: string | null): string | null {
  if (!raw) return null;
  const href = raw.trim();
  if (/^https?:\/\//i.test(href) || href.startsWith("mailto:")) return href;
  if (/^www\./i.test(href)) return `https://${href}`;
  return null;
}

function safeColor(raw: string | null): string | null {
  if (!raw) return null;
  const color = raw.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return color;
  if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(color)) return color;
  return null;
}

function safeTextAlign(raw: string | null): string | null {
  if (!raw) return null;
  const align = raw.trim().toLowerCase();
  if (align === "left" || align === "center" || align === "right" || align === "justify") return align;
  return null;
}

function textAlignFromAttrs(attrs: string): string | null {
  const style = attrValue(attrs, "style") || "";
  const match = style.match(/text-align\s*:\s*([^;]+)/i);
  return safeTextAlign(match ? match[1] : attrValue(attrs, "align"));
}

function openBlockTag(name: string, attrs: string): string {
  const align = textAlignFromAttrs(attrs);
  return align ? `<${name} style="text-align:${align}">` : `<${name}>`;
}

/** True when a saved draft is editor HTML rather than plain/markdown text. */
export function looksLikeHtml(value: string | null | undefined): boolean {
  return /<\/?(?:p|div|ul|ol|li|a|br|strong|em|b|i|u|h[1-6]|blockquote|span)\b/i.test(value ?? "");
}

/**
 * Allowlist sanitizer so pasted Word/Docs/Gmail HTML can keep links and lists
 * without scripts or event handlers.
 */
export function sanitizeEmailHtml(html: string): string {
  let s = (html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  s = s.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (full, tag: string, attrs: string) => {
    const name = tag.toLowerCase();
    const closing = full.startsWith("</");
    if (!ALLOWED_TAGS.has(name)) return "";
    if (name === "br") return "<br>";
    if (closing) return `</${name}>`;
    if (name === "a") {
      const href = safeHref(attrValue(attrs, "href"));
      return href ? `<a href="${escapeHtml(href)}">` : "<span>";
    }
    if (name === "span") {
      const style = attrValue(attrs, "style") || "";
      const colorMatch = style.match(/color\s*:\s*([^;]+)/i);
      const color = safeColor(colorMatch ? colorMatch[1].trim() : attrValue(attrs, "color"));
      return color ? `<span style="color:${color}">` : "<span>";
    }
    if (name === "p" || name === "div" || name === "h1" || name === "h2" || name === "h3" || name === "li" || name === "blockquote") {
      return openBlockTag(name, attrs);
    }
    return `<${name}>`;
  });

  return s.replace(/<a>([\s\S]*?)<\/a>/gi, "$1");
}

function applyGmailInlineStyles(html: string): string {
  return html
    .replace(/<a href="([^"]+)">/gi, '<a href="$1" style="color:#1a73e8;text-decoration:underline">')
    .replace(/<ul>/gi, '<ul style="margin:0 0 12px 0;padding-left:24px;list-style-type:disc">')
    .replace(/<ol>/gi, '<ol style="margin:0 0 12px 0;padding-left:24px;list-style-type:decimal">')
    .replace(/<li(?: style="text-align:(left|center|right|justify)")?>/gi, (_, align) =>
      align ? `<li style="margin:0 0 4px 0;text-align:${align}">` : '<li style="margin:0 0 4px 0">'
    )
    .replace(/<p(?: style="text-align:(left|center|right|justify)")?>/gi, (_, align) =>
      align ? `<p style="margin:0 0 12px 0;text-align:${align}">` : '<p style="margin:0 0 12px 0">'
    )
    .replace(/<h1(?: style="text-align:(left|center|right|justify)")?>/gi, (_, align) =>
      align ? `<h1 style="font-size:20px;margin:0 0 12px 0;text-align:${align}">` : '<h1 style="font-size:20px;margin:0 0 12px 0">'
    )
    .replace(/<h2(?: style="text-align:(left|center|right|justify)")?>/gi, (_, align) =>
      align ? `<h2 style="font-size:18px;margin:0 0 12px 0;text-align:${align}">` : '<h2 style="font-size:18px;margin:0 0 12px 0">'
    )
    .replace(/<h3(?: style="text-align:(left|center|right|justify)")?>/gi, (_, align) =>
      align ? `<h3 style="font-size:16px;margin:0 0 12px 0;text-align:${align}">` : '<h3 style="font-size:16px;margin:0 0 12px 0">'
    )
    .replace(/<blockquote>/gi, '<blockquote style="margin:0 0 12px 0;padding-left:12px;border-left:3px solid #ccc">');
}

export function draftToEditorHtml(value: string | null | undefined): string {
  const v = value ?? "";
  if (!v.trim()) return "<p></p>";
  if (looksLikeHtml(v)) {
    const cleaned = sanitizeEmailHtml(v);
    return cleaned.trim() ? cleaned : "<p></p>";
  }
  return markdownToEditorHtml(v);
}

export function draftToPlainText(value: string | null | undefined): string {
  const v = value ?? "";
  if (!v.trim()) return "";
  if (looksLikeHtml(v)) return editorHtmlToMarkdown(v);
  return v;
}

export function draftToEmailHtml(value: string | null | undefined): string {
  const v = value ?? "";
  if (looksLikeHtml(v)) {
    const inner = applyGmailInlineStyles(sanitizeEmailHtml(v));
    return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222">${inner}</div>`;
  }
  return markdownToEmailHtml(v);
}
