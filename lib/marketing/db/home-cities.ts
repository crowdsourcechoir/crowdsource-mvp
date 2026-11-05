import {
  classifyHomeCity,
  DUPLICATE_HOME_SEGMENT_NAMES,
  HOME_CITIES,
  HOME_CITY_MARKER,
  homeCitySegmentRules,
  topCounts,
  type HomeCity,
} from "../home-cities";
import { marketingDb } from "./client";
import { raiseDb } from "./errors";
import { createSegment, deleteSegment, listSegments, updateSegment } from "./segments";

const PAGE = 1000;
const WRITE_CHUNK = 100;

export type HomeCityAssignment = {
  applied: boolean;
  already: boolean;
  spokane: number;
  boise: number;
  seattle: number;
  cities: { value: string; count: number }[];
  tags: { value: string; count: number }[];
};

type SourceRow = {
  id: string;
  city: string | null;
  region: string | null;
  person_tags: { tag: string }[] | { tag: string } | null;
};

function tagsOf(row: SourceRow): string[] {
  const value = row.person_tags;
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => item.tag).filter(Boolean);
}

async function loadSources(): Promise<SourceRow[]> {
  const db = marketingDb();
  const rows: SourceRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("people")
      .select("id, city, region, person_tags(tag)")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    raiseDb(error);
    const page = (data ?? []) as SourceRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

async function writeCities(updates: { id: string; city: HomeCity }[]): Promise<void> {
  const db = marketingDb();
  const now = new Date().toISOString();
  for (const city of HOME_CITIES) {
    const ids = updates.filter((row) => row.city === city).map((row) => row.id);
    for (let index = 0; index < ids.length; index += WRITE_CHUNK) {
      const slice = ids.slice(index, index + WRITE_CHUNK);
      const { error } = await db.from("people").update({ city, updated_at: now }).in("id", slice);
      raiseDb(error);
    }
  }
}

async function ensureHomeSegments(): Promise<void> {
  const description = `${HOME_CITY_MARKER} Spokane and Boise kept their city. Everyone else is Seattle.`;
  const segments = await listSegments();
  for (const city of HOME_CITIES) {
    const matches = segments.filter((segment) => segment.name === city);
    const rules = homeCitySegmentRules(city);
    const primary = matches[0];
    if (primary) {
      await updateSegment({ id: primary.id, description, rules });
      for (const extra of matches.slice(1)) await deleteSegment(extra.id);
    } else {
      await createSegment({ name: city, description, rules });
    }
  }
  const refreshed = await listSegments();
  const duplicates = new Set<string>(DUPLICATE_HOME_SEGMENT_NAMES);
  const seen = new Set<string>();
  for (const segment of refreshed) {
    if (duplicates.has(segment.name)) {
      await deleteSegment(segment.id);
      continue;
    }
    if (!seen.has(segment.name) || !(HOME_CITIES as readonly string[]).includes(segment.name)) {
      seen.add(segment.name);
      continue;
    }
    await deleteSegment(segment.id);
  }
}

/**
 * Label every contact Seattle, Spokane, or Boise and save those three segments.
 * Refuses to relabel the list when it cannot find both Spokane and Boise.
 */
export async function assignHomeCities(): Promise<HomeCityAssignment> {
  const existing = await listSegments();
  if (existing.some((segment) => segment.name === "Seattle" && (segment.description ?? "").startsWith(HOME_CITY_MARKER))) {
    return { applied: true, already: true, spokane: 0, boise: 0, seattle: 0, cities: [], tags: [] };
  }

  const sources = await loadSources();
  const classified = sources.map((row) => {
    const tags = tagsOf(row);
    const result = classifyHomeCity({
      city: row.city,
      region: row.region,
      tags,
    });
    return { id: row.id, current: row.city, tags, ...result };
  });
  const spokane = classified.filter((row) => row.reason === "spokane").length;
  const boise = classified.filter((row) => row.reason === "boise").length;
  const seattle = classified.length - spokane - boise;
  const cities = topCounts(sources.map((row) => row.city ?? ""));
  const tags = topCounts(classified.flatMap((row) => row.tags), 12);

  if (spokane === 0 || boise === 0) {
    return { applied: false, already: false, spokane, boise, seattle, cities, tags };
  }

  await writeCities(
    classified
      .filter((row) => (row.current ?? "") !== row.city)
      .map((row) => ({ id: row.id, city: row.city }))
  );
  await ensureHomeSegments();
  return { applied: true, already: false, spokane, boise, seattle, cities, tags };
}
