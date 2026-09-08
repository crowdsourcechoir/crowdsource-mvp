import { isPlausibleEmail, looksLikePersonName, normalizeEmail } from "@/lib/sales/dedupe";

export type PastedContact = {
  fullName: string;
  email: string;
};

const EMAIL_RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/**
 * Detect pasted outreach lists like:
 *   Khalilah Elliott: kelliott@carnegiehall.org Sam Meyer: smeyer@carnegiehall.org
 *   "Sam Meyer" <smeyer@carnegiehall.org>
 *   Maddie Brolly mbrolly@carnegiehall.org
 *
 * Role searches ("events team") have no emails and return [].
 */
export function parseContactPaste(raw: string): PastedContact[] {
  const text = raw.replace(/\u00a0/g, " ").trim();
  if (!text.includes("@")) return [];

  const matches = Array.from(text.matchAll(EMAIL_RE));
  if (matches.length === 0) return [];

  const out: PastedContact[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const email = normalizeEmail(match[1] ?? "");
    if (!email || !isPlausibleEmail(email) || seen.has(email)) continue;

    const prevEnd =
      i === 0 ? 0 : (matches[i - 1]!.index ?? 0) + (matches[i - 1]![0]?.length ?? 0);
    const emailStart = match.index ?? 0;
    let before = text.slice(prevEnd, emailStart).trim();
    before = before.replace(/^[\s,;|/·•\-–—]+/, "").replace(/[\s,;|/·•\-–—]+$/, "").trim();
    before = before.replace(/:\s*$/, "").trim();
    // "Name" <email> / Name <email> — drop quoting and angle brackets before name parse
    before = before.replace(/[<>]/g, " ").replace(/["']/g, " ").replace(/\s+/g, " ").trim();
    before = before.replace(/:\s*$/, "").trim();

    let fullName = before;
    if (!looksLikePersonName(fullName)) {
      const parts = before.split(/\s+/).filter(Boolean);
      fullName = "";
      for (let n = Math.min(4, parts.length); n >= 2; n--) {
        const candidate = parts.slice(-n).join(" ");
        if (looksLikePersonName(candidate)) {
          fullName = candidate;
          break;
        }
      }
    }
    if (!looksLikePersonName(fullName)) continue;

    seen.add(email);
    out.push({ fullName, email });
  }

  return out;
}

export function looksLikeContactPaste(raw: string): boolean {
  return parseContactPaste(raw).length > 0;
}
