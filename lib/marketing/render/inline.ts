import { escapePreservingTokens, safeHref } from "./html";
import { escapeHtml } from "./html";

type InlineMark =
  | { type: "bold" | "italic" | "underline" }
  | { type: "link"; attrs?: { href?: string } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function renderNodes(nodes: unknown, linkColor: string): string {
  if (!Array.isArray(nodes)) return "";
  return nodes.map((node) => renderNode(node, linkColor)).join("");
}

function renderNode(node: unknown, linkColor: string): string {
  if (!isRecord(node) || typeof node.type !== "string") return "";
  if (node.type === "text") {
    let html = escapePreservingTokens(typeof node.text === "string" ? node.text : "");
    const marks = Array.isArray(node.marks) ? (node.marks as InlineMark[]) : [];
    for (const mark of marks) {
      if (!mark || typeof mark !== "object") continue;
      if (mark.type === "bold") html = `<strong>${html}</strong>`;
      else if (mark.type === "italic") html = `<em>${html}</em>`;
      else if (mark.type === "underline") html = `<u>${html}</u>`;
      else if (mark.type === "link") {
        const href = safeHref(mark.attrs?.href ?? "");
        html = href
          ? `<a href="${escapeHtml(href)}" style="color:${escapeHtml(linkColor)};text-decoration:underline;">${html}</a>`
          : html;
      }
    }
    return html;
  }
  if (node.type === "personalization") {
    const attrs = isRecord(node.attrs) ? node.attrs : {};
    const token = attrs.token;
    if (token === "first_name" || token === "display_name" || token === "city" || token === "email") {
      return `{{${token}}}`;
    }
    return "";
  }
  if (node.type === "paragraph") {
    const inner = renderNodes(node.content, linkColor);
    return `<p>${inner || "&nbsp;"}</p>`;
  }
  if (node.type === "bulletList") return `<ul>${renderNodes(node.content, linkColor)}</ul>`;
  if (node.type === "orderedList") return `<ol>${renderNodes(node.content, linkColor)}</ol>`;
  if (node.type === "listItem") return `<li>${renderNodes(node.content, linkColor)}</li>`;
  return "";
}

export function plainTextToHtml(text: string): string {
  if (!text.trim()) return "";
  return text
    .split(/\n\n+/)
    .map((paragraph) => `<p>${escapePreservingTokens(paragraph).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

export function inlineDocumentToHtml(raw: unknown, linkColor: string): string {
  if (!isRecord(raw) || raw.type !== "doc") return "";
  return renderNodes(raw.content, linkColor);
}

export function inlineToPlainText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (!isRecord(raw)) return "";
  if (raw.type === "text" && typeof raw.text === "string") return raw.text;
  if (raw.type === "personalization" && isRecord(raw.attrs) && typeof raw.attrs.token === "string") {
    return `{{${raw.attrs.token}}}`;
  }
  if (!Array.isArray(raw.content)) return "";
  const parts = raw.content.map((child) => inlineToPlainText(child)).filter(Boolean);
  if (raw.type === "paragraph" || raw.type === "listItem") return parts.join("");
  return parts.join("\n");
}
