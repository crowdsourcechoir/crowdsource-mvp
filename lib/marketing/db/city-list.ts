import type { SegmentRule } from "../types";
import { normalizeMarketingEmail } from "../ids";
import { marketingDb } from "./client";
import { raiseDb } from "./errors";
import { upsertPerson } from "./people";
import { createSegment, deleteSegment, listSegments, updateSegment } from "./segments";

const LOOKUP_CHUNK = 200;

export type CityListResult = {
  matched: number;
  created: number;
  updated: number;
  skipped: number;
};

function cityRules(city: string): SegmentRule[] {
  return [
    { field: "status", op: "eq", value: "subscribed" },
    { field: "marketingConsent", op: "eq", value: true },
    { field: "city", op: "eq", value: city },
  ];
}

function normalizeEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of emails) {
    const email = normalizeMarketingEmail(raw);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    unique.push(email);
  }
  return unique;
}

async function findExisting(emails: string[]): Promise<Map<string, { id: string; city: string | null }>> {
  const db = marketingDb();
  const found = new Map<string, { id: string; city: string | null }>();
  for (let index = 0; index < emails.length; index += LOOKUP_CHUNK) {
    const slice = emails.slice(index, index + LOOKUP_CHUNK);
    const { data, error } = await db.from("people").select("id, normalized_email, city").in("normalized_email", slice);
    raiseDb(error);
    for (const row of (data ?? []) as { id: string; normalized_email: string; city: string | null }[]) {
      found.set(row.normalized_email, { id: row.id, city: row.city });
    }
  }
  return found;
}

async function ensureCitySegment(city: string): Promise<void> {
  const rules = cityRules(city);
  const segments = await listSegments();
  const match = segments.find((segment) => segment.name.trim().toLowerCase() === city.toLowerCase());
  if (match) await updateSegment({ id: match.id, name: city, description: "Uploaded city list.", rules });
  else await createSegment({ name: city, description: "Uploaded city list.", rules });
  const duplicateName = `${city} subscribers`.toLowerCase();
  for (const segment of segments) {
    if (segment.name.trim().toLowerCase() === duplicateName) await deleteSegment(segment.id);
  }
}

/**
 * Match a city list to people already in the audience.
 * Existing emails get that city. Missing emails are added once.
 * The city segment is subscribed people in that city.
 */
export async function applyCityList(city: string, emails: string[]): Promise<CityListResult> {
  const unique = normalizeEmails(emails);
  const existing = await findExisting(unique);
  const now = new Date().toISOString();
  const db = marketingDb();
  const ids = Array.from(existing.values())
    .filter((person) => (person.city ?? "") !== city)
    .map((person) => person.id);
  for (let index = 0; index < ids.length; index += LOOKUP_CHUNK) {
    const slice = ids.slice(index, index + LOOKUP_CHUNK);
    const { error } = await db.from("people").update({ city, updated_at: now }).in("id", slice);
    raiseDb(error);
  }

  let created = 0;
  let skipped = 0;
  for (const email of unique) {
    if (existing.has(email)) continue;
    const result = await upsertPerson({
      email,
      city,
      status: "subscribed",
      marketingConsent: true,
      consentSource: "mailchimp_import",
      acquisitionSource: "mailchimp",
      respectSuppression: true,
    });
    if (!result.ok || result.skippedReason) skipped += 1;
    else if (result.created) created += 1;
  }

  await ensureCitySegment(city);
  return {
    matched: existing.size,
    created,
    updated: ids.length,
    skipped,
  };
}
