/** Shared sales search: sanitize the query, build PostgREST `or` filters, merge hits by org. */

export const SEARCH_MIN_CHARS = 2;
export const SEARCH_RESULT_LIMIT = 30;

export type SalesSearchKind = "organization" | "contact" | "opportunity" | "draft" | "finding";

export type SalesSearchHit = {
  organizationId: string;
  organizationName: string;
  websiteUrl: string | null;
  queueItemId: string | null;
  opportunityTitle: string | null;
  kind: SalesSearchKind;
  matchLabel: string;
};

export type SearchMatch = {
  organizationId: string;
  organizationName?: string | null;
  kind: SalesSearchKind;
  label: string;
  rank: number;
};

/** Strip PostgREST/LIKE metacharacters so the term is safe inside an `or()` ilike clause. */
export function sanitizeSearchTerm(raw: string): string {
  return raw
    .trim()
    .replace(/[%_*,()"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function orIlike(columns: string[], term: string): string {
  const pattern = `%${term}%`;
  return columns.map((column) => `${column}.ilike."${pattern}"`).join(",");
}

export function matchRank(kind: SalesSearchKind, haystack: string, term: string): number {
  const h = haystack.trim().toLowerCase();
  const t = term.trim().toLowerCase();
  if (!h || !t) return 0;
  const kindBoost =
    kind === "organization" ? 40 : kind === "contact" ? 30 : kind === "opportunity" ? 20 : kind === "draft" ? 10 : 0;
  if (h === t) return 100 + kindBoost;
  if (h.startsWith(t)) return 80 + kindBoost;
  if (h.includes(t)) return 50 + kindBoost;
  return 20 + kindBoost;
}

export function mergeSearchHits(
  matches: SearchMatch[],
  orgs: { id: string; name: string; websiteUrl: string | null }[],
  queueByOrg: Map<string, { queueItemId: string; opportunityTitle: string | null }>
): SalesSearchHit[] {
  const orgById = new Map(orgs.map((o) => [o.id, o]));
  const best = new Map<string, SearchMatch>();
  for (const match of matches) {
    if (!match.organizationId) continue;
    const prev = best.get(match.organizationId);
    if (!prev || match.rank > prev.rank) best.set(match.organizationId, match);
  }

  const hits: SalesSearchHit[] = [];
  for (const [orgId, match] of Array.from(best.entries())) {
    const org = orgById.get(orgId);
    const name = (org?.name || match.organizationName || "").trim();
    if (!name) continue;
    const queued = queueByOrg.get(orgId);
    hits.push({
      organizationId: orgId,
      organizationName: name,
      websiteUrl: org?.websiteUrl ?? null,
      queueItemId: queued?.queueItemId ?? null,
      opportunityTitle: queued?.opportunityTitle ?? null,
      kind: match.kind,
      matchLabel: match.label,
    });
  }

  hits.sort((a, b) => {
    const ra = best.get(a.organizationId)?.rank ?? 0;
    const rb = best.get(b.organizationId)?.rank ?? 0;
    if (rb !== ra) return rb - ra;
    if (Boolean(b.queueItemId) !== Boolean(a.queueItemId)) return a.queueItemId ? -1 : 1;
    return a.organizationName.localeCompare(b.organizationName);
  });

  return hits.slice(0, SEARCH_RESULT_LIMIT);
}
