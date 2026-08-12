const EVENT_SLUG_ALIASES: Record<string, string> = {
  thresholds: "csc-oct8",
};

export function canonicalEventSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  return EVENT_SLUG_ALIASES[normalized] ?? slug;
}

export function isAliasedEventSlug(slug: string): boolean {
  return canonicalEventSlug(slug) !== slug;
}

export function publicEventPath(slug: string): string {
  return `/e/${canonicalEventSlug(slug)}`;
}

export function publicEventUrl(baseUrl: string | null | undefined, slug: string): string {
  const base = (baseUrl ?? "").replace(/\/$/, "") || "http://localhost:3000";
  return `${base}${publicEventPath(slug)}`;
}
