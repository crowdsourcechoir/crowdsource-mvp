import type { OrganizationType } from "../types";
import {
  MAJOR_CONVENTION_CITIES,
  type DiscoveryMode,
  type DiscoveryRunOptions,
  normalizeDiscoveryOptions,
} from "./presets";

/**
 * Generic event/gathering phrasings for the default org-type rotation.
 */
const QUERY_MODIFIERS = [
  "annual conference",
  "national convention",
  "regional conference schedule",
  "member conference agenda",
];

/** How many queries a single discovery run spends by default. */
export const MAX_QUERIES_PER_RUN = 6;

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diffMs = date.getTime() - start.getTime();
  return Math.floor(diffMs / 86_400_000);
}

function rotateSlice<T>(items: T[], rotation: number, limit: number): T[] {
  if (items.length === 0) return [];
  const start = ((rotation % items.length) + items.length) % items.length;
  const rotated = [...items.slice(start), ...items.slice(0, start)];
  return rotated.slice(0, limit);
}

function buildDefaultQueries(organizationTypes: OrganizationType[], year: number, maxQueries: number, rotation: number): string[] {
  const activeTypes = organizationTypes.filter((t) => t.isActive);
  const combos: string[] = [];
  for (const type of activeTypes) {
    for (const modifier of QUERY_MODIFIERS) {
      combos.push(`${type.label} ${modifier} ${year}`);
    }
  }
  return rotateSlice(combos, rotation, maxQueries);
}

/**
 * Convention-center calendars are the cleanest "big budget / books a hall" signal.
 * We search venue calendars and large events at those venues, then extract the HOSTING
 * organization (association / conference organizer), not the venue itself.
 */
function buildConventionCenterQueries(cities: string[], year: number, maxQueries: number, rotation: number, focus?: string): string[] {
  const cityList = cities.length > 0 ? cities : [...MAJOR_CONVENTION_CITIES];
  const templates = [
    (city: string) => `${city} convention center events calendar ${year}`,
    (city: string) => `${city} convention center annual conferences ${year} associations`,
    (city: string) => `large conferences at ${city} convention center ${year} attendance`,
    (city: string) => `${city} convention center upcoming association meetings ${year}`,
  ];
  const combos: string[] = [];
  for (const city of cityList) {
    for (const tmpl of templates) {
      combos.push(tmpl(city));
    }
  }
  if (focus) {
    for (const city of cityList.slice(0, 8)) {
      combos.push(`${focus} ${city} convention center ${year}`);
    }
  }
  // Always include a couple of national aggregator queries for hall-scale events.
  combos.push(`largest association conferences convention centers ${year}`);
  combos.push(`associations booking convention centers annual meeting ${year} 1000+ attendees`);
  return rotateSlice(combos, rotation, maxQueries);
}

function buildCustomQueries(focus: string, year: number, maxQueries: number, cities?: string[]): string[] {
  const base = focus.trim();
  if (!base) return [];
  const queries = [
    `${base} annual conference ${year}`,
    `${base} national convention ${year}`,
    `${base} association meeting convention center ${year}`,
    `${base} large conference 1000 attendees ${year}`,
    `${base} events calendar ${year}`,
  ];
  for (const city of (cities ?? []).slice(0, 6)) {
    queries.push(`${base} ${city} ${year}`);
    queries.push(`${base} ${city} convention center ${year}`);
  }
  return queries.slice(0, maxQueries);
}

/**
 * Builds discovery search queries for the requested mode. Cron uses default (org-type rotation).
 * Manual runs can pass convention_centers or custom focus via DiscoveryRunOptions.
 */
export function buildDiscoveryQueries(
  organizationTypes: OrganizationType[],
  options?: DiscoveryRunOptions | null,
  now: Date = new Date(),
  rotationOverride?: number
): string[] {
  const opts = normalizeDiscoveryOptions(options);
  const year = opts.year ?? now.getFullYear() + 1;
  const maxQueries = opts.maxQueries ?? MAX_QUERIES_PER_RUN;
  const rotation = rotationOverride ?? dayOfYear(now);
  const mode: DiscoveryMode = opts.mode;

  if (mode === "convention_centers") {
    return buildConventionCenterQueries(opts.cities ?? [], year, maxQueries, rotation, opts.focus);
  }
  if (mode === "custom") {
    const focus = opts.focus || "association annual conference convention center";
    return buildCustomQueries(focus, year, maxQueries, opts.cities);
  }
  return buildDefaultQueries(organizationTypes, year, maxQueries, rotation);
}
