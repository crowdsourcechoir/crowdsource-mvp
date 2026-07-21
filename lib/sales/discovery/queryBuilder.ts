import type { OrganizationType } from "../types";

/**
 * Generic event/gathering phrasings, not tied to any one organization type — combined with
 * each active `organization_types` label to form a search query. This is what makes discovery
 * generalize: adding a new organization type row to the DB automatically gets queried on a
 * future night, no code change required here.
 */
const QUERY_MODIFIERS = ["annual conference", "national convention", "regional conference schedule", "member conference agenda"];

/** How many queries a single discovery run actually spends (cost control, mirrors MAX_ENRICHMENT_PER_RUN in enrichContacts.ts). */
export const MAX_QUERIES_PER_RUN = 6;

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diffMs = date.getTime() - start.getTime();
  return Math.floor(diffMs / 86_400_000);
}

/**
 * Builds the full (org_type x modifier) combination set, then returns a rotating slice of it —
 * a different slice each calendar day — so a fixed nightly query budget still gets broad
 * coverage across every active organization type over time instead of hammering the same few
 * every night. `now`/`rotationOverride` are only for deterministic testing.
 */
export function buildDiscoveryQueries(
  organizationTypes: OrganizationType[],
  now: Date = new Date(),
  rotationOverride?: number
): string[] {
  const year = now.getFullYear();
  const nextYear = year + 1;
  const activeTypes = organizationTypes.filter((t) => t.isActive);

  const combos: string[] = [];
  for (const type of activeTypes) {
    for (const modifier of QUERY_MODIFIERS) {
      combos.push(`${type.label} ${modifier} ${nextYear}`);
    }
  }
  if (combos.length === 0) return [];

  const rotation = (rotationOverride ?? dayOfYear(now)) % combos.length;
  const rotated = [...combos.slice(rotation), ...combos.slice(0, rotation)];
  return rotated.slice(0, MAX_QUERIES_PER_RUN);
}
