export const HOME_CITIES = ["Spokane", "Boise", "Seattle"] as const;

export type HomeCity = (typeof HOME_CITIES)[number];

export type HomeCityReason = "spokane" | "boise" | "seattle";

export type HomeCitySource = {
  city?: string | null;
  region?: string | null;
  tags?: string[];
};

const SPOKANE = /\bspokane\b/i;
const BOISE = /\bboise\b/i;

function hit(pattern: RegExp, value: string | null | undefined): boolean {
  return pattern.test(value ?? "");
}

function pick(source: HomeCitySource, pattern: RegExp): boolean {
  if (hit(pattern, source.city)) return true;
  if ((source.tags ?? []).some((tag) => hit(pattern, tag))) return true;
  if (hit(pattern, source.region)) return true;
  return false;
}

/** Spokane and Boise come from the contact's city, tags, or address text. Everyone else is Seattle. */
export function classifyHomeCity(source: HomeCitySource): { city: HomeCity; reason: HomeCityReason } {
  const spokane = pick(source, SPOKANE);
  const boise = pick(source, BOISE);
  if (spokane && !boise) return { city: "Spokane", reason: "spokane" };
  if (boise && !spokane) return { city: "Boise", reason: "boise" };
  if (spokane && boise) {
    if (hit(SPOKANE, source.city) && !hit(BOISE, source.city)) return { city: "Spokane", reason: "spokane" };
    if (hit(BOISE, source.city) && !hit(SPOKANE, source.city)) return { city: "Boise", reason: "boise" };
    const tags = (source.tags ?? []).join(" ");
    if (hit(SPOKANE, tags) && !hit(BOISE, tags)) return { city: "Spokane", reason: "spokane" };
    if (hit(BOISE, tags) && !hit(SPOKANE, tags)) return { city: "Boise", reason: "boise" };
  }
  return { city: "Seattle", reason: "seattle" };
}

export function topCounts(values: string[], limit = 8): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

export const HOME_CITY_MARKER = "home-cities-v1";

export const DUPLICATE_HOME_SEGMENT_NAMES = [
  "Seattle subscribers",
  "Spokane subscribers",
  "Boise subscribers",
] as const;

export function homeCitySegmentRules(city: HomeCity) {
  return [
    { field: "status" as const, op: "eq" as const, value: "subscribed" },
    { field: "marketingConsent" as const, op: "eq" as const, value: true },
    { field: "city" as const, op: "eq" as const, value: city },
  ];
}
