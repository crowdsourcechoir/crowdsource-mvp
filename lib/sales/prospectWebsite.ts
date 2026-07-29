/**
 * Resolves the best website to show in prospect info: prefer a conference/event-specific URL,
 * otherwise fall back to the organization's main site.
 */

const EVENT_URL_HINT =
  /(?:^|[./_-])(?:event|events|conference|convention|summit|symposium|forum|annual[-_]?meeting|gathering|expo|festival)(?:[./_-]|$)/i;

export type ProspectWebsite = {
  url: string;
  /** Human label for the queue / digest — distinguishes event vs org fallback. */
  label: "Event website" | "Organization website";
  source: "event" | "organization";
};

/** Normalize a maybe-URL into an absolute http(s) URL, or null if unusable. */
export function normalizeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function looksLikeEventUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return EVENT_URL_HINT.test(parsed.hostname) || EVENT_URL_HINT.test(parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Prefer an explicit event/conference website; otherwise the first event-looking finding source
 * URL; otherwise the organization's main site. Never invents a URL.
 */
export function resolveProspectWebsite(options: {
  eventWebsiteUrl?: string | null;
  organizationWebsiteUrl?: string | null;
  findingSourceUrls?: Array<string | null | undefined>;
}): ProspectWebsite | null {
  const storedEvent = normalizeHttpUrl(options.eventWebsiteUrl);
  if (storedEvent) {
    return { url: storedEvent, label: "Event website", source: "event" };
  }

  for (const raw of options.findingSourceUrls ?? []) {
    const url = normalizeHttpUrl(raw);
    if (!url) continue;
    if (!looksLikeEventUrl(url)) continue;
    return { url, label: "Event website", source: "event" };
  }

  const orgUrl = normalizeHttpUrl(options.organizationWebsiteUrl);
  if (orgUrl) {
    return { url: orgUrl, label: "Organization website", source: "organization" };
  }

  return null;
}
