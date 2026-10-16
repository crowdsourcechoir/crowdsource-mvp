/**
 * Queue place search — filter sidebar rows by organization city or region/state.
 * Region codes (WA) and names (Washington) match each other. Two-letter queries
 * match a whole word so "WA" does not hit "Walla Walla" or "Hawaii".
 */

export type QueuePlaceFields = {
  locationCity?: string | null;
  locationRegion?: string | null;
};

const REGIONS: ReadonlyArray<readonly [string, string]> = [
  ["al", "alabama"],
  ["ak", "alaska"],
  ["az", "arizona"],
  ["ar", "arkansas"],
  ["ca", "california"],
  ["co", "colorado"],
  ["ct", "connecticut"],
  ["de", "delaware"],
  ["dc", "district of columbia"],
  ["fl", "florida"],
  ["ga", "georgia"],
  ["hi", "hawaii"],
  ["id", "idaho"],
  ["il", "illinois"],
  ["in", "indiana"],
  ["ia", "iowa"],
  ["ks", "kansas"],
  ["ky", "kentucky"],
  ["la", "louisiana"],
  ["me", "maine"],
  ["md", "maryland"],
  ["ma", "massachusetts"],
  ["mi", "michigan"],
  ["mn", "minnesota"],
  ["ms", "mississippi"],
  ["mo", "missouri"],
  ["mt", "montana"],
  ["ne", "nebraska"],
  ["nv", "nevada"],
  ["nh", "new hampshire"],
  ["nj", "new jersey"],
  ["nm", "new mexico"],
  ["ny", "new york"],
  ["nc", "north carolina"],
  ["nd", "north dakota"],
  ["oh", "ohio"],
  ["ok", "oklahoma"],
  ["or", "oregon"],
  ["pa", "pennsylvania"],
  ["ri", "rhode island"],
  ["sc", "south carolina"],
  ["sd", "south dakota"],
  ["tn", "tennessee"],
  ["tx", "texas"],
  ["ut", "utah"],
  ["vt", "vermont"],
  ["va", "virginia"],
  ["wa", "washington"],
  ["wv", "west virginia"],
  ["wi", "wisconsin"],
  ["wy", "wyoming"],
  ["ab", "alberta"],
  ["bc", "british columbia"],
  ["mb", "manitoba"],
  ["nb", "new brunswick"],
  ["nl", "newfoundland and labrador"],
  ["ns", "nova scotia"],
  ["nt", "northwest territories"],
  ["nu", "nunavut"],
  ["on", "ontario"],
  ["pe", "prince edward island"],
  ["qc", "quebec"],
  ["sk", "saskatchewan"],
  ["yt", "yukon"],
];

/** Nicknames that do not appear inside the stored city name. */
const PLACE_ALIASES: Record<string, readonly string[]> = {
  nyc: ["new york"],
  sf: ["san francisco"],
  nola: ["new orleans"],
  la: ["los angeles"],
  philly: ["philadelphia"],
};

export function normalizePlace(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function clean(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return text || null;
}

function metaString(meta: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!meta) return null;
  for (const key of keys) {
    const value = meta[key];
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (text) return text;
  }
  return null;
}

/** Column values win; CSV import blobs still count when the columns were never filled. */
export function resolveQueuePlace(input: {
  locationCity?: string | null;
  locationRegion?: string | null;
  importMetadata?: Record<string, unknown> | null;
}): { locationCity: string | null; locationRegion: string | null } {
  return {
    locationCity:
      clean(input.locationCity) ||
      metaString(input.importMetadata, ["City", "city", "location_city", "locationCity"]),
    locationRegion:
      clean(input.locationRegion) ||
      metaString(input.importMetadata, ["State", "state", "Region", "region", "location_region", "locationRegion"]),
  };
}

export function formatQueuePlace(item: QueuePlaceFields): string | null {
  const label = [clean(item.locationCity), clean(item.locationRegion)].filter(Boolean).join(", ");
  return label || null;
}

function includesPlace(field: string, needle: string): boolean {
  if (!field || !needle) return false;
  if (needle.length <= 2) {
    return field === needle || field.split(" ").includes(needle);
  }
  return field.includes(needle);
}

function regionsForQuery(query: string): Array<{ code: string; name: string }> {
  const hits: Array<{ code: string; name: string }> = [];
  for (const [code, name] of REGIONS) {
    const exact = query === code || query === name;
    const prefix = query.length >= 3 && name.startsWith(query);
    if (exact || prefix) hits.push({ code, name });
  }
  return hits;
}

function stateMatches(city: string, region: string, state: { code: string; name: string }): boolean {
  const regionHit =
    region === state.code || region === state.name || region.split(" ").includes(state.code);
  if (regionHit) return true;
  const cityHit = city === state.name || city.includes(state.name);
  if (!cityHit) return false;
  if (!region) return true;
  return region === state.code || region === state.name || region.split(" ").includes(state.code);
}

function queryNeedles(query: string): string[] {
  const needles = [query];
  if (query.startsWith("st ")) needles.push(`saint ${query.slice(3)}`);
  if (query.startsWith("saint ")) needles.push(`st ${query.slice(6)}`);
  for (const alias of PLACE_ALIASES[query] ?? []) needles.push(alias);
  return needles;
}

export function matchesQueuePlace(item: QueuePlaceFields, raw: string | null | undefined): boolean {
  const query = normalizePlace(raw ?? "");
  if (!query) return true;
  const city = normalizePlace(item.locationCity ?? "");
  const region = normalizePlace(item.locationRegion ?? "");
  if (!city && !region) return false;
  if (queryNeedles(query).some((needle) => includesPlace(city, needle) || includesPlace(region, needle))) {
    return true;
  }
  return regionsForQuery(query).some((state) => stateMatches(city, region, state));
}
