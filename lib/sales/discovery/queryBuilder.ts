import type { OrganizationType } from "../types";
import { getDiscoveryMaxQueriesPerRun } from "./config";

/**
 * Event/gathering phrasings mixed with long-tail / regional / non-conference shapes so nightly
 * discovery doesn't only re-hit the same "annual conference" SERP head already covered by the
 * seeded Conferences CSV.
 */
const QUERY_MODIFIERS = [
  "annual conference",
  "national convention",
  "regional conference",
  "state association conference",
  "member meeting agenda",
  "leadership summit",
  "annual gala",
  "festival lineup",
  "fan event calendar",
  "orientation week kickoff",
  "season opener celebration",
  "destination events calendar",
];

/** Geographic / niche templates that deliberately aim below the national SERP head. */
const LONGTAIL_TEMPLATES = [
  "state {type} association annual meeting {year}",
  "regional {type} conference mid-size {year}",
  "{type} chapter conference under 2000 attendees {year}",
  "emerging {type} summit participatory experience {year}",
  "local {type} festival audience engagement {year}",
  "{type} membership retreat agenda {year}",
];

/** US regions / state names rotated into long-tail queries for geographic diversity. */
const GEO_HINTS = [
  "Midwest",
  "Pacific Northwest",
  "Southeast",
  "New England",
  "Texas",
  "California",
  "Colorado",
  "Great Lakes",
  "Mountain West",
  "Mid-Atlantic",
];

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diffMs = date.getTime() - start.getTime();
  return Math.floor(diffMs / 86_400_000);
}

/**
 * Builds a rotating mix of classic org-type×modifier queries plus long-tail geo/niche templates.
 * A different slice each calendar day so a fixed nightly budget still covers the pool over time.
 * `now`/`rotationOverride` are only for deterministic testing.
 */
export function buildDiscoveryQueries(
  organizationTypes: OrganizationType[],
  now: Date = new Date(),
  rotationOverride?: number
): string[] {
  const year = now.getFullYear();
  const nextYear = year + 1;
  const activeTypes = organizationTypes.filter((t) => t.isActive);
  const maxQueries = getDiscoveryMaxQueriesPerRun();

  const combos: string[] = [];
  for (const type of activeTypes) {
    for (const modifier of QUERY_MODIFIERS) {
      combos.push(`${type.label} ${modifier} ${nextYear}`);
    }
  }

  const doy = rotationOverride ?? dayOfYear(now);
  for (let i = 0; i < activeTypes.length; i++) {
    const type = activeTypes[i];
    const geo = GEO_HINTS[(doy + i) % GEO_HINTS.length];
    for (const template of LONGTAIL_TEMPLATES) {
      combos.push(
        template
          .replaceAll("{type}", type.label)
          .replaceAll("{year}", String(nextYear))
          .replace(/^/, `${geo} `)
      );
    }
  }

  // Explicit "list of" queries — listicles are where unknown orgs hide; extractor now mines them.
  for (const type of activeTypes) {
    combos.push(`best ${type.label} conferences ${nextYear} list`);
    combos.push(`${type.label} association directory regional chapters`);
  }

  if (combos.length === 0) return [];

  const rotation = doy % combos.length;
  const rotated = [...combos.slice(rotation), ...combos.slice(0, rotation)];
  return rotated.slice(0, maxQueries);
}

/** @deprecated Use getDiscoveryMaxQueriesPerRun() — kept for any external imports. */
export const MAX_QUERIES_PER_RUN = 8;
