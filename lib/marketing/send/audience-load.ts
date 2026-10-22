import { marketingDb } from "../db/client";
import { raiseDb } from "../db/errors";
import type { SegmentDefinition } from "../segments/definition";
import { personMatchesSegment, sendablePeople, type AudiencePerson } from "./audience";

const PAGE = 200;

type SubscriptionRow = { id: string; status: string; channel: string; topic: string };
type SuppressionRow = { active: boolean; scope: string };
type TagRow = { tag: string };

type PersonRow = {
  id: string;
  normalized_email: string;
  display_name: string | null;
  first_name: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  acquisition_source: string | null;
  person_tags: TagRow[] | TagRow | null;
  communication_subscriptions: SubscriptionRow[] | SubscriptionRow | null;
  suppressions: SuppressionRow[] | SuppressionRow | null;
};

function asArray<T>(value: T[] | T | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function asSegmentDefinition(value: unknown): SegmentDefinition | null {
  if (!value || typeof value !== "object") return null;
  const row = value as SegmentDefinition;
  if (row.schemaVersion !== 1 || row.match !== "all" || !Array.isArray(row.conditions)) return null;
  return row;
}

function toPerson(row: PersonRow): AudiencePerson | null {
  const subscription = asArray(row.communication_subscriptions).find(
    (item) => item.channel === "email" && item.topic === "marketing"
  );
  if (!subscription?.id) return null;
  const suppressed = asArray(row.suppressions).some(
    (item) => item.active && (item.scope === "marketing" || item.scope === "all_email")
  );
  return {
    personId: row.id,
    subscriptionId: subscription.id,
    email: row.normalized_email,
    firstName: row.first_name,
    displayName: row.display_name,
    city: row.city,
    region: row.region,
    country: row.country,
    acquisitionSource: row.acquisition_source,
    tags: asArray(row.person_tags).map((item) => item.tag.trim().toLowerCase()),
    subscriptionStatus: subscription.status,
    suppressed,
  };
}

export async function loadAudience(segmentId: string): Promise<{
  definition: SegmentDefinition;
  matched: AudiencePerson[];
  sendable: AudiencePerson[];
}> {
  const db = marketingDb();
  const { data: segment, error: segmentError } = await db.from("segments").select("definition").eq("id", segmentId).maybeSingle();
  raiseDb(segmentError);
  const definition = asSegmentDefinition((segment as { definition?: unknown } | null)?.definition);
  if (!definition) {
    return {
      definition: { schemaVersion: 1, match: "all", conditions: [] },
      matched: [],
      sendable: [],
    };
  }

  const people: AudiencePerson[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("people")
      .select(
        `id, normalized_email, display_name, first_name, city, region, country, acquisition_source,
         person_tags (tag),
         communication_subscriptions (id, status, channel, topic),
         suppressions (active, scope)`
      )
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    raiseDb(error);
    const rows = (data ?? []) as PersonRow[];
    for (const row of rows) {
      const person = toPerson(row);
      if (person) people.push(person);
    }
    if (rows.length < PAGE) break;
  }

  const matched = people.filter((person) => personMatchesSegment(person, definition));
  return { definition, matched, sendable: sendablePeople(people, definition) };
}
