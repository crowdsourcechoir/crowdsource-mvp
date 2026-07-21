import { createHash } from "crypto";

const MAX_EXCERPT_LENGTH = 6000;
const FETCH_TIMEOUT_MS = 8000;
/** Only used as a fallback when link discovery on the homepage finds nothing relevant (e.g. a homepage with no visible nav links). */
export const FALLBACK_SUBPATHS = ["/about", "/contact", "/staff", "/events"];

export type FetchedPage = {
  url: string;
  ok: boolean;
  status: number | null;
  title: string | null;
  text: string | null;
  html: string | null;
  contentHash: string | null;
  error: string | null;
};

export type DiscoveredLink = { url: string; anchorText: string; score: number };

/** Weighted keyword hits against a link's URL path + anchor text — not a generic crawler, biased toward the two page types this business actually needs: who to contact, and what event/program is happening. */
const RELEVANCE_KEYWORDS: { pattern: RegExp; weight: number }[] = [
  { pattern: /contact/i, weight: 3 },
  { pattern: /staff|directory|who[-_]?to[-_]?contact/i, weight: 3 },
  { pattern: /leadership|board|administration|our[-_]?team/i, weight: 2 },
  { pattern: /\bteam\b|\bpeople\b|\bwho\b/i, weight: 1 },
  { pattern: /event|conference|calendar|agenda|schedule|program/i, weight: 3 },
  { pattern: /register|registration/i, weight: 1 },
  { pattern: /about/i, weight: 1 },
  { pattern: /news|press/i, weight: 1 },
];

const EXCLUDED_HREF_PATTERN = /^(mailto:|tel:|javascript:|#)|\.(pdf|jpg|jpeg|png|gif|svg|zip|doc|docx)$/i;
const OFFSITE_KEYWORDS = /facebook\.com|twitter\.com|x\.com|instagram\.com|linkedin\.com|youtube\.com/i;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&#x26;/gi, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(html: string): { title: string | null; text: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const text = withoutScripts
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return { title, text };
}

/**
 * Fetches one URL and returns sanitized plain text (plus raw HTML for link discovery), capped
 * in length. Never throws — failures are returned as `{ ok: false, error }` so callers can
 * continue the pipeline. Content returned here is later wrapped in an explicit untrusted-data
 * delimiter before ever reaching a model prompt (see pipeline/stages/research.ts).
 */
export async function fetchPageText(url: string): Promise<FetchedPage> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "CrowdsourceChoirSalesResearchBot/0.1 (+https://app.crowdsourcechoir.com)" },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return { url, ok: false, status: res.status, title: null, text: null, html: null, contentHash: null, error: `HTTP ${res.status}` };
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text")) {
      return {
        url,
        ok: false,
        status: res.status,
        title: null,
        text: null,
        html: null,
        contentHash: null,
        error: `Unsupported content-type: ${contentType}`,
      };
    }
    const html = await res.text();
    const { title, text } = stripHtml(html);
    const capped = text.slice(0, MAX_EXCERPT_LENGTH);
    const contentHash = createHash("sha256").update(capped).digest("hex").slice(0, 16);
    return { url, ok: true, status: res.status, title, text: capped, html, contentHash, error: null };
  } catch (err) {
    return {
      url,
      ok: false,
      status: null,
      title: null,
      text: null,
      html: null,
      contentHash: null,
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

/** Extracts same-origin `<a href>` links with their anchor text, scored by relevance to "who to contact" / "what event is happening" — the two things this pipeline actually needs from a site, regardless of that site's URL structure. */
export function discoverRelevantLinks(html: string, pageUrl: string, limit: number): DiscoveredLink[] {
  const base = new URL(pageUrl);
  const seen = new Map<string, DiscoveredLink>();
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html))) {
    const rawHref = decodeHtmlEntities(match[1].trim());
    if (!rawHref || EXCLUDED_HREF_PATTERN.test(rawHref) || OFFSITE_KEYWORDS.test(rawHref)) continue;
    let absolute: URL;
    try {
      absolute = new URL(rawHref, base);
    } catch {
      continue;
    }
    if (absolute.host !== base.host) continue; // same-origin only — this isn't a general web crawler
    const anchorText = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const haystack = `${absolute.pathname} ${anchorText}`;
    const score = RELEVANCE_KEYWORDS.reduce((sum, { pattern, weight }) => (pattern.test(haystack) ? sum + weight : sum), 0);
    if (score <= 0) continue;
    const key = absolute.toString();
    const existing = seen.get(key);
    if (!existing || existing.score < score) seen.set(key, { url: key, anchorText, score });
  }
  return Array.from(seen.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function homepageUrl(websiteUrl: string): string | null {
  try {
    const base = new URL(/^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`);
    return `${base.protocol}//${base.host}`;
  } catch {
    return null;
  }
}

export function fallbackCandidateUrls(origin: string): string[] {
  return FALLBACK_SUBPATHS.map((p) => `${origin}${p}`);
}
