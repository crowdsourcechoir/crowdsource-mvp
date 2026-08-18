/**
 * Pull plain text from a Gmail API message payload (full format).
 * Prefer text/plain parts; fall back to stripped text/html; finally snippet.
 */

type GmailPart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailPart[] | null;
};

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64").toString("utf8");
}

function collectParts(part: GmailPart | null | undefined, into: { plain: string[]; html: string[] }): void {
  if (!part) return;
  const mime = (part.mimeType ?? "").toLowerCase();
  if (part.body?.data) {
    const text = decodeBase64Url(part.body.data);
    if (mime === "text/plain") into.plain.push(text);
    else if (mime === "text/html") into.html.push(text);
  }
  for (const child of part.parts ?? []) collectParts(child, into);
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractPlainTextFromGmailPayload(
  payload: GmailPart | null | undefined,
  snippet: string | null | undefined
): string {
  const bags = { plain: [] as string[], html: [] as string[] };
  collectParts(payload ?? undefined, bags);
  if (bags.plain.length > 0) return bags.plain.join("\n").trim();
  if (bags.html.length > 0) return stripHtml(bags.html.join("\n"));
  return (snippet ?? "").trim();
}
