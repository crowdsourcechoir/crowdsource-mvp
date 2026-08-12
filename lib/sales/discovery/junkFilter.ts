/**
 * Deterministic pre-create filter for discovery candidates.
 * The LLM extract prompt already asks to skip venues/CVBs/ticketing — this is the
 * backstop so obvious junk never becomes an organizations row (and never burns a
 * pipeline run for a lead that can't clear the solid-score bar).
 */

export type JunkRejectReason = string;

const NAME_PATTERNS: RegExp[] = [
  /\bconvention\s+center\b/i,
  /\bconference\s+center\b/i,
  /\bexpo\s+center\b/i,
  /\bexhibition\s+(?:center|centre|hall)\b/i,
  /\bcivic\s+center\b/i,
  /\baren[ae]\b/i,
  /\bstadium\b/i,
  /\bvisit\s+[a-z]/i, // Visit Nashville / Visit Orlando DMOs
  /\bdestination\s+marketing\b/i,
  /\bconvention\s+(?:&|and)\s+visitors?\b/i,
  /\bCVB\b/,
  /\btourism\s+board\b/i,
  /\beventbrite\b/i,
  /\bcvent\b/i,
  /\b10times\b/i,
  /\bmeetup\b/i,
  /\bticketmaster\b/i,
  /\bwikipedia\b/i,
  /\byelp\b/i,
  /\btripadvisor\b/i,
  /\blinkedin\b/i,
  /\bfacebook\b/i,
  /\bhotels?\b/i,
  /\bmarriott\b/i,
  /\bhilton\b/i,
  /\bhyatt\b/i,
];

const HOST_PATTERNS: RegExp[] = [
  /(?:^|\.)eventbrite\./i,
  /(?:^|\.)cvent\./i,
  /(?:^|\.)10times\./i,
  /(?:^|\.)meetup\./i,
  /(?:^|\.)ticketmaster\./i,
  /(?:^|\.)wikipedia\./i,
  /(?:^|\.)linkedin\./i,
  /(?:^|\.)facebook\./i,
  /(?:^|\.)tripadvisor\./i,
  /(?:^|\.)yelp\./i,
  /(?:^|\.)marriott\./i,
  /(?:^|\.)hilton\./i,
  /(?:^|\.)hyatt\./i,
  /visit[a-z0-9-]+\.(com|org)/i,
];

function hostFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProto).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

/** Returns a reason string if this candidate should not be created; otherwise null. */
export function junkDiscoveryReason(name: string, websiteUrl?: string | null): JunkRejectReason | null {
  const trimmed = name.trim();
  if (!trimmed) return "empty name";

  for (const re of NAME_PATTERNS) {
    if (re.test(trimmed)) return `name matches junk pattern (${re.source})`;
  }

  const host = hostFromUrl(websiteUrl);
  if (host) {
    for (const re of HOST_PATTERNS) {
      if (re.test(host)) return `website host looks like a directory/venue (${host})`;
    }
  }

  return null;
}
