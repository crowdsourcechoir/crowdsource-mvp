/**
 * Queue drafts stay stored as plain text. Lists use markdown markers so existing
 * emails keep working. The editor and Gmail HTML path round-trip those markers.
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
  return escapedText.replace(URL_RE, (raw) => {
    const trimmed = raw.replace(/[),.;:!?]+$/g, "");
    const trailing = raw.slice(trimmed.length);
    const href = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    return `<a href="${escapeHtml(href)}" style="color:#1a73e8;text-decoration:underline">${escapeHtml(trimmed)}</a>${trailing}`;
  });
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
  return escapeHtml(text).replace(/\n/g, "<br>");
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
        return `<ul style="margin:0 0 12px 0;padding-left:24px">${items}</ul>`;
      }
      if (block.type === "ol") {
        const items = block.items.map((item) => `<li style="margin:0 0 4px 0">${linkifyInline(escapeHtml(item))}</li>`).join("");
        return `<ol style="margin:0 0 12px 0;padding-left:24px">${items}</ol>`;
      }
      const text = block.lines.map((line) => linkifyInline(escapeHtml(line))).join("<br>");
      return `<p style="margin:0 0 12px 0">${text || "&nbsp;"}</p>`;
    })
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222">${inner}</div>`;
}

function listItemsFromHtml(inner: string, ordered: boolean): string {
  const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];
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
 * Serialize contentEditable HTML (and pasted Word/Docs HTML) back to markdown lists.
 */
export function editorHtmlToMarkdown(html: string): string {
  if (!html) return "";
  let s = html.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");

  s = s.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => `\n${listItemsFromHtml(inner, false)}\n`);
  s = s.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => `\n${listItemsFromHtml(inner, true)}\n`);
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => `\n- ${stripTagsKeepText(inner).replace(/\n+/g, " ").trim()}\n`);

  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|h[1-6]|tr)>/gi, "\n");
  s = s.replace(/<(p|div|h[1-6]|tr)\b[^>]*>/gi, "");
  s = s.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
    const label = stripTagsKeepText(text) || href;
    return label === href || href.includes(label.replace(/^https?:\/\//, "")) ? href : `${label} ${href}`;
  });
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
