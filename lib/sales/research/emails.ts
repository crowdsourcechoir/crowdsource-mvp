/**
 * Deterministic email extraction / validation helpers for research + contact verification.
 * The model is instructed not to invent emails, but it still does — so every candidate address
 * must also appear literally in the fetched page (or decode from Cloudflare email-protection)
 * before we trust it enough to write a contacts row.
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Cloudflare's email-protection obfuscation: first byte is XOR key, rest are XOR'd hex pairs. */
export function decodeCloudflareEmail(encoded: string): string | null {
  try {
    if (encoded.length < 4 || encoded.length % 2 !== 0) return null;
    const key = parseInt(encoded.slice(0, 2), 16);
    if (Number.isNaN(key)) return null;
    let out = "";
    for (let i = 2; i < encoded.length; i += 2) {
      const code = parseInt(encoded.slice(i, i + 2), 16);
      if (Number.isNaN(code)) return null;
      out += String.fromCharCode(code ^ key);
    }
    // Drop mailto query junk Cloudflare sometimes appends ("nacada@ksu.edu?subject=...")
    const email = out.split("?")[0]?.trim().toLowerCase() ?? "";
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}

export function extractEmailsFromText(text: string | null | undefined): Set<string> {
  const found = new Set<string>();
  if (!text) return found;
  const matches = text.match(EMAIL_RE) ?? [];
  for (const match of matches) {
    found.add(match.toLowerCase());
  }
  return found;
}

export function extractEmailsFromHtml(html: string | null | undefined): Set<string> {
  const found = extractEmailsFromText(html);
  if (!html) return found;
  const cfAttrs = html.match(/data-cfemail=["']([a-f0-9]+)["']/gi) ?? [];
  for (const attr of cfAttrs) {
    const hex = attr.match(/([a-f0-9]+)/i)?.[1];
    // attr is like data-cfemail="aabb" — take the quoted hex only
    const quoted = /["']([a-f0-9]+)["']/i.exec(attr)?.[1];
    const decoded = decodeCloudflareEmail(quoted ?? hex ?? "");
    if (decoded) found.add(decoded);
  }
  const cfHashes = html.match(/email-protection#([a-f0-9]+)/gi) ?? [];
  for (const frag of cfHashes) {
    const hex = frag.split("#")[1];
    const decoded = decodeCloudflareEmail(hex ?? "");
    if (decoded) found.add(decoded);
  }
  const mailtos = html.match(/mailto:([^"'>\s]+)/gi) ?? [];
  for (const frag of mailtos) {
    try {
      const raw = decodeURIComponent(frag.replace(/^mailto:/i, "")).split("?")[0].trim().toLowerCase();
      if (raw.includes("@")) found.add(raw);
    } catch {
      // malformed mailto — ignore
    }
  }
  return found;
}

/** True only when `email` appears literally in page text or HTML (including CF-decoded addresses). */
export function emailLiterallyPresent(
  email: string | null | undefined,
  pageText: string | null | undefined,
  pageHtml: string | null | undefined
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return false;
  if (pageText && pageText.toLowerCase().includes(normalized)) return true;
  return extractEmailsFromHtml(pageHtml).has(normalized);
}
