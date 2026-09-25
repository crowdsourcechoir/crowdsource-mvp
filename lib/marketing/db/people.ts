import {
  decideConsent,
  presentationStatus,
  subscriptionEventSource,
  suppressionSourceFor,
  type ConsentSnapshot,
  type RequestedAudienceStatus,
  type SubscriptionStatus,
  type SuppressionReason,
} from "../consent";
import { normalizeMarketingEmail } from "../ids";
import type { AcquisitionSource, MarketingPerson, MarketingStatus } from "../types";
import { marketingDb } from "./client";
import { raiseDb } from "./errors";

const PERSON_SELECT = `
  id, normalized_email, display_name, first_name, last_name, city, region, country,
  attributes, acquisition_source, created_at, updated_at,
  person_emails (email, normalized_email, is_primary),
  person_tags (tag),
  communication_subscriptions (id, status, consented_at, unsubscribed_at, channel, topic),
  suppressions (reason, active, created_at, scope)
`;

type SubscriptionRow = {
  id: string;
  status: SubscriptionStatus;
  consented_at: string | null;
  unsubscribed_at: string | null;
  channel: string;
  topic: string;
};

type PersonRow = {
  id: string;
  normalized_email: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  attributes: Record<string, unknown> | null;
  acquisition_source: AcquisitionSource;
  created_at: string;
  updated_at: string;
  person_emails: { email: string; normalized_email: string; is_primary: boolean }[] | null;
  person_tags: { tag: string }[] | null;
  communication_subscriptions: SubscriptionRow[] | null;
  suppressions: { reason: SuppressionReason; active: boolean; created_at: string; scope: string }[] | null;
};

const REASONS = new Set<SuppressionReason>(["unsubscribe", "hard_bounce", "complaint", "manual"]);

function asArray<T>(value: T[] | T | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function marketingSubscription(row: PersonRow): SubscriptionRow | null {
  return (
    asArray(row.communication_subscriptions).find((sub) => sub.channel === "email" && sub.topic === "marketing") ??
    null
  );
}

function snapshotOf(row: PersonRow): ConsentSnapshot | null {
  const subscription = marketingSubscription(row);
  if (!subscription) return null;
  const activeReasons = asArray(row.suppressions)
    .filter((item) => item.active && (item.scope === "marketing" || item.scope === "all_email"))
    .map((item) => item.reason)
    .filter((reason): reason is SuppressionReason => REASONS.has(reason));
  return { status: subscription.status, activeReasons };
}

export function rowToMarketingPerson(row: PersonRow): MarketingPerson {
  const snapshot = snapshotOf(row);
  const subscription = marketingSubscription(row);
  const attributes = row.attributes ?? {};
  const primary = asArray(row.person_emails).find((email) => email.is_primary) ?? asArray(row.person_emails)[0];
  const activeSuppressions = asArray(row.suppressions).filter((item) => item.active);
  const suppressedAt = activeSuppressions
    .map((item) => item.created_at)
    .sort()[0] ?? null;
  const status = presentationStatus(snapshot);
  return {
    id: row.id,
    email: primary?.email ?? row.normalized_email,
    normalizedEmail: row.normalized_email,
    displayName: row.display_name,
    city: row.city,
    region: row.region,
    country: row.country,
    status,
    marketingConsent: status === "subscribed",
    consentAt: subscription?.consented_at ?? null,
    consentSource: typeof attributes.consent_source === "string" ? attributes.consent_source : null,
    acquisitionSource: row.acquisition_source,
    acquisitionDetail:
      attributes.acquisition_detail && typeof attributes.acquisition_detail === "object"
        ? (attributes.acquisition_detail as Record<string, unknown>)
        : null,
    tags: asArray(row.person_tags).map((tag) => tag.tag),
    mailchimpId: typeof attributes.mailchimp_id === "string" ? attributes.mailchimp_id : null,
    suppressedAt: status === "subscribed" ? null : suppressedAt,
    bounceClass: snapshot?.activeReasons.includes("hard_bounce") ? "hard" : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadByNormalized(normalized: string): Promise<PersonRow | null> {
  const db = marketingDb();
  const { data, error } = await db.from("people").select(PERSON_SELECT).eq("normalized_email", normalized).maybeSingle();
  raiseDb(error);
  return (data as PersonRow | null) ?? null;
}

async function loadById(id: string): Promise<PersonRow | null> {
  const db = marketingDb();
  const { data, error } = await db.from("people").select(PERSON_SELECT).eq("id", id).maybeSingle();
  raiseDb(error);
  return (data as PersonRow | null) ?? null;
}

function splitName(display: string | null): { first: string | null; last: string | null } {
  if (!display?.trim()) return { first: null, last: null };
  const parts = display.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0] ?? null, last: null };
  return { first: parts[0] ?? null, last: parts.slice(1).join(" ") };
}

function eventTypeFor(input: {
  created: boolean;
  previous: SubscriptionStatus | null;
  next: SubscriptionStatus;
  liftUnsubscribe: boolean;
  source: string;
}): string {
  if (input.liftUnsubscribe && input.next === "subscribed") return "resubscribed";
  if (input.created && input.source === "mailchimp_import" && input.next === "subscribed") return "imported";
  if (input.next === "unsubscribed") return "unsubscribed";
  if (input.next === "pending") return "pending";
  if (!input.created && input.previous !== "subscribed" && input.next === "subscribed") return "resubscribed";
  return "subscribed";
}

export type UpsertPersonInput = {
  email: string;
  displayName?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  status?: MarketingStatus;
  marketingConsent?: boolean;
  consentSource?: string | null;
  acquisitionSource?: AcquisitionSource;
  acquisitionDetail?: Record<string, unknown> | null;
  tags?: string[];
  mailchimpId?: string | null;
  externalId?: string | null;
  respectSuppression?: boolean;
};

export type UpsertPersonResult =
  | { ok: true; person: MarketingPerson; created: boolean; skippedReason?: string }
  | { ok: false; error: string };

function requestedStatus(input: UpsertPersonInput): RequestedAudienceStatus {
  if (input.status === "unsubscribed" || input.status === "cleaned" || input.status === "pending") return input.status;
  if (input.marketingConsent === false && !input.status) return "unsubscribed";
  return "subscribed";
}

export async function upsertPerson(input: UpsertPersonInput): Promise<UpsertPersonResult> {
  const normalized = normalizeMarketingEmail(input.email);
  if (!normalized) return { ok: false, error: "Invalid email" };

  const existing = await loadByNormalized(normalized);
  const snapshot = existing ? snapshotOf(existing) : null;
  const plan = decideConsent({
    requested: requestedStatus(input),
    respectSuppression: input.respectSuppression !== false,
    existing: snapshot,
  });
  const now = new Date().toISOString();
  const db = marketingDb();
  const created = !existing;
  const names = splitName(input.displayName ?? existing?.display_name ?? null);
  const previousAttributes = existing?.attributes ?? {};
  const attributes: Record<string, unknown> = { ...previousAttributes };
  if (input.mailchimpId) attributes.mailchimp_id = input.mailchimpId;
  if (input.consentSource) attributes.consent_source = input.consentSource;
  if (input.externalId) attributes.external_id = input.externalId;
  if (input.acquisitionDetail) {
    const prior =
      previousAttributes.acquisition_detail && typeof previousAttributes.acquisition_detail === "object"
        ? (previousAttributes.acquisition_detail as Record<string, unknown>)
        : {};
    attributes.acquisition_detail = { ...prior, ...input.acquisitionDetail };
  }

  const acquisition =
    !existing
      ? input.acquisitionSource ?? "manual"
      : input.acquisitionSource && existing.acquisition_source === "manual"
        ? input.acquisitionSource
        : existing.acquisition_source;

  const profile = {
    display_name: input.displayName !== undefined ? input.displayName : existing?.display_name ?? null,
    first_name: existing?.first_name || names.first,
    last_name: existing?.last_name || names.last,
    city: input.city !== undefined ? input.city : existing?.city ?? null,
    region: input.region !== undefined ? input.region : existing?.region ?? null,
    country: input.country !== undefined ? input.country : existing?.country ?? null,
    attributes,
    acquisition_source: acquisition,
    updated_at: now,
  };

  let personId = existing?.id ?? "";
  if (!existing) {
    const { data, error } = await db
      .from("people")
      .insert({ normalized_email: normalized, ...profile })
      .select("id")
      .single();
    raiseDb(error);
    personId = String((data as { id: string }).id);
    const { error: emailError } = await db.from("person_emails").insert({
      person_id: personId,
      email: input.email.trim(),
      normalized_email: normalized,
      is_primary: true,
    });
    raiseDb(emailError);
  } else {
    const { error } = await db.from("people").update(profile).eq("id", existing.id);
    raiseDb(error);
    personId = existing.id;
  }

  if (input.tags?.length) {
    const current = new Set(asArray(existing?.person_tags).map((tag) => tag.tag));
    const additions = input.tags
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag && !current.has(tag));
    if (additions.length) {
      const { error } = await db.from("person_tags").insert(additions.map((tag) => ({ person_id: personId, tag })));
      raiseDb(error);
    }
  }

  const previousStatus = snapshot?.status ?? null;
  const alreadySuppressed = new Set(snapshot?.activeReasons ?? []);
  const missingSuppressions = plan.skippedReason ? [] : plan.ensure.filter((reason) => !alreadySuppressed.has(reason));
  const statusChanged =
    !plan.skippedReason &&
    (created || previousStatus !== plan.status || plan.liftUnsubscribe || missingSuppressions.length > 0);
  if (statusChanged) {
    const subscription = existing ? marketingSubscription(existing) : null;
    const consentedAt =
      plan.status === "subscribed" ? subscription?.consented_at ?? now : subscription?.consented_at ?? null;
    const unsubscribedAt = plan.status === "unsubscribed" ? now : subscription?.unsubscribed_at ?? null;
    const { data: savedSub, error: subError } = await db
      .from("communication_subscriptions")
      .upsert(
        {
          person_id: personId,
          channel: "email",
          topic: "marketing",
          status: plan.status,
          consented_at: consentedAt,
          unsubscribed_at: unsubscribedAt,
          updated_at: now,
        },
        { onConflict: "person_id,channel,topic" }
      )
      .select("id")
      .single();
    raiseDb(subError);

    const source = subscriptionEventSource(input.consentSource, acquisition);
    const eventType = eventTypeFor({
      created,
      previous: previousStatus,
      next: plan.status,
      liftUnsubscribe: plan.liftUnsubscribe,
      source,
    });
    const { error: eventError } = await db.from("subscription_events").insert({
      person_id: personId,
      subscription_id: (savedSub as { id: string }).id,
      event_type: eventType,
      source,
      metadata: {
        consentSource: input.consentSource ?? null,
        requested: requestedStatus(input),
      },
    });
    raiseDb(eventError);
  }

  if (plan.liftUnsubscribe) {
    const { error } = await db
      .from("suppressions")
      .update({ active: false, lifted_at: now })
      .eq("person_id", personId)
      .eq("reason", "unsubscribe")
      .eq("active", true);
    raiseDb(error);
    const { error: liftEventError } = await db.from("subscription_events").insert({
      person_id: personId,
      subscription_id: null,
      event_type: "suppression_lifted",
      source: "admin",
      metadata: { reason: "unsubscribe" },
    });
    raiseDb(liftEventError);
  }

  if (missingSuppressions.length) {
    const source = suppressionSourceFor(acquisition);
    const rows = missingSuppressions.map((reason) => ({
        person_id: personId,
        normalized_email: normalized,
        scope: "marketing",
        reason,
        source,
        active: true,
      }));
    if (rows.length) {
      const { error } = await db.from("suppressions").insert(rows);
      raiseDb(error);
    }
  }

  const fresh = await loadById(personId);
  if (!fresh) return { ok: false, error: "Upsert failed" };
  return {
    ok: true,
    person: rowToMarketingPerson(fresh),
    created,
    skippedReason: plan.skippedReason,
  };
}

export async function listPeople(opts?: {
  q?: string;
  status?: MarketingStatus;
  limit?: number;
}): Promise<MarketingPerson[]> {
  const db = marketingDb();
  const { data, error } = await db.from("people").select(PERSON_SELECT).order("created_at", { ascending: false }).limit(5000);
  raiseDb(error);
  let rows = ((data ?? []) as PersonRow[]).map(rowToMarketingPerson);
  if (opts?.status) rows = rows.filter((person) => person.status === opts.status);
  if (opts?.q?.trim()) {
    const q = opts.q.trim().toLowerCase();
    rows = rows.filter(
      (person) =>
        person.email.toLowerCase().includes(q) ||
        (person.displayName ?? "").toLowerCase().includes(q) ||
        (person.city ?? "").toLowerCase().includes(q) ||
        person.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }
  return rows.slice(0, opts?.limit ?? 500);
}

export async function audienceTotals(): Promise<{
  all: number;
  subscribed: number;
  unsubscribed: number;
  cleaned: number;
}> {
  const db = marketingDb();
  const { data, error } = await db.rpc("marketing_audience_totals");
  raiseDb(error);
  const totals = (data ?? {}) as { all?: number; subscribed?: number; unsubscribed?: number; cleaned?: number };
  return {
    all: totals.all ?? 0,
    subscribed: totals.subscribed ?? 0,
    unsubscribed: totals.unsubscribed ?? 0,
    cleaned: totals.cleaned ?? 0,
  };
}

export async function getPerson(id: string): Promise<MarketingPerson | null> {
  const row = await loadById(id);
  return row ? rowToMarketingPerson(row) : null;
}

export async function unsubscribeByEmail(email: string): Promise<MarketingPerson | null> {
  const normalized = normalizeMarketingEmail(email);
  if (!normalized) return null;
  const existing = await loadByNormalized(normalized);
  if (!existing) return null;
  const result = await upsertPerson({
    email: existing.normalized_email,
    status: "unsubscribed",
    marketingConsent: false,
    consentSource: "unsubscribe_link",
    respectSuppression: false,
  });
  return result.ok ? result.person : null;
}
