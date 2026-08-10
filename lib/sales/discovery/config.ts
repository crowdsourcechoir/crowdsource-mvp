/**
 * Tunable discovery volume knobs. Defaults keep overnight cost bounded; raise via env once
 * long-tail queries are producing real new orgs (see queryBuilder + extractCandidates).
 */

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/** How many search queries a single discovery run spends (default 8). */
export function getDiscoveryMaxQueriesPerRun(): number {
  return readEnvInt("SALES_DISCOVERY_MAX_QUERIES", 8);
}

/** Hard cap on brand-new organization rows created per discovery run (default 20). */
export function getDiscoveryMaxNewOrganizationsPerRun(): number {
  return readEnvInt("SALES_DISCOVERY_MAX_NEW_ORGS", 20);
}

/** SERP results requested per query (default 12 — deeper than the old 8 to reach past seed head). */
export function getDiscoveryMaxResultsPerQuery(): number {
  return readEnvInt("SALES_DISCOVERY_MAX_RESULTS", 12);
}

/** How many known org domains to append as `-site:` excludes (default 40). */
export function getDiscoveryExcludeDomainCount(): number {
  return readEnvInt("SALES_DISCOVERY_EXCLUDE_DOMAINS", 40);
}
