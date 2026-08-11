/**
 * Manual/cron discovery focus modes. Cron keeps `default`; the admin UI can pick a higher-signal
 * mode (convention centers) or pass a custom focus string.
 */

export type DiscoveryMode = "default" | "convention_centers" | "custom";

export type DiscoveryRunOptions = {
  mode?: DiscoveryMode;
  /** Override / subset of cities for convention_centers mode. */
  cities?: string[];
  /** Free-text focus for custom mode (and optional extra spice for other modes). */
  focus?: string;
  /** Event year to bias queries toward (defaults to next calendar year). */
  year?: number;
  /** Cap new org creates for this run (defaults to discovery constant). */
  maxNewOrganizations?: number;
  /** How many search queries to spend (defaults to queryBuilder constant). */
  maxQueries?: number;
};

/** Destinations that routinely host hall-booking annual meetings. */
export const MAJOR_CONVENTION_CITIES = [
  "Nashville",
  "Chicago",
  "Orlando",
  "Las Vegas",
  "Denver",
  "Seattle",
  "Atlanta",
  "Dallas",
  "Boston",
  "Washington DC",
  "New Orleans",
  "San Diego",
  "Phoenix",
  "Minneapolis",
  "Philadelphia",
  "Houston",
  "Austin",
  "Miami",
  "San Francisco",
  "Detroit",
] as const;

export const DISCOVERY_MODE_OPTIONS: {
  id: DiscoveryMode;
  label: string;
  description: string;
}[] = [
  {
    id: "default",
    label: "Default (org types)",
    description: "Rotating association / conference queries by organization type — same as nightly cron.",
  },
  {
    id: "convention_centers",
    label: "Convention centers (major cities)",
    description:
      "Hunt events booking convention centers — strongest signal for big-budget annual gatherings.",
  },
  {
    id: "custom",
    label: "Custom focus",
    description: "Write your own search focus; we’ll turn it into several targeted queries.",
  },
];

export function normalizeDiscoveryOptions(raw?: DiscoveryRunOptions | null): Required<
  Pick<DiscoveryRunOptions, "mode">
> &
  DiscoveryRunOptions {
  const mode: DiscoveryMode =
    raw?.mode === "convention_centers" || raw?.mode === "custom" || raw?.mode === "default"
      ? raw.mode
      : "default";
  const cities = (raw?.cities ?? [])
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 20);
  const focus = raw?.focus?.trim() || undefined;
  const year =
    typeof raw?.year === "number" && Number.isFinite(raw.year) && raw.year >= 2024 && raw.year <= 2035
      ? Math.floor(raw.year)
      : undefined;
  const maxNewOrganizations =
    typeof raw?.maxNewOrganizations === "number" && raw.maxNewOrganizations > 0
      ? Math.min(50, Math.floor(raw.maxNewOrganizations))
      : undefined;
  const maxQueries =
    typeof raw?.maxQueries === "number" && raw.maxQueries > 0
      ? Math.min(20, Math.floor(raw.maxQueries))
      : undefined;
  return { mode, cities: cities.length ? cities : undefined, focus, year, maxNewOrganizations, maxQueries };
}
