import { newId, normalizeMarketingEmail } from "./ids";
import { updateMarketingStore, readMarketingStore } from "./store";
import type {
  AcquisitionSource,
  MarketingAcquisitionEvent,
  MarketingPerson,
  MarketingStatus,
} from "./types";

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
  /** When true, never flip unsubscribed/cleaned back to subscribed. */
  respectSuppression?: boolean;
};

export type UpsertPersonResult =
  | { ok: true; person: MarketingPerson; created: boolean; skippedReason?: string }
  | { ok: false; error: string };

export async function upsertMarketingPerson(input: UpsertPersonInput): Promise<UpsertPersonResult> {
  const normalizedEmail = normalizeMarketingEmail(input.email);
  if (!normalizedEmail) return { ok: false, error: "Invalid email" };

  let created = false;
  let skippedReason: string | undefined;
  let personOut: MarketingPerson | null = null;

  const { store, error } = await updateMarketingStore((store) => {
    const now = new Date().toISOString();
    const existing = store.people.find((p) => p.normalizedEmail === normalizedEmail);
    const respect = input.respectSuppression !== false;

    if (existing) {
      const nextStatus = input.status ?? existing.status;
      // Never re-subscribe suppressed contacts from imports/ingest.
      if (
        respect &&
        (existing.status === "unsubscribed" || existing.status === "cleaned") &&
        nextStatus === "subscribed"
      ) {
        skippedReason = `Preserved ${existing.status} status`;
        personOut = existing;
        return;
      }

      existing.displayName = input.displayName !== undefined ? input.displayName : existing.displayName;
      existing.city = input.city !== undefined ? input.city : existing.city;
      existing.region = input.region !== undefined ? input.region : existing.region;
      existing.country = input.country !== undefined ? input.country : existing.country;
      if (input.status) existing.status = input.status;
      if (typeof input.marketingConsent === "boolean") {
        existing.marketingConsent = input.marketingConsent;
        if (input.marketingConsent) {
          existing.consentAt = existing.consentAt ?? now;
          existing.consentSource = input.consentSource ?? existing.consentSource;
        }
      }
      if (input.acquisitionSource && existing.acquisitionSource === "manual") {
        existing.acquisitionSource = input.acquisitionSource;
      }
      if (input.acquisitionDetail) {
        existing.acquisitionDetail = { ...(existing.acquisitionDetail ?? {}), ...input.acquisitionDetail };
      }
      if (input.tags?.length) {
        const set = new Set([...existing.tags, ...input.tags]);
        existing.tags = Array.from(set);
      }
      if (input.mailchimpId) existing.mailchimpId = input.mailchimpId;
      existing.updatedAt = now;
      personOut = existing;

      if (input.externalId || input.acquisitionSource) {
        const acq: MarketingAcquisitionEvent = {
          id: newId("acq"),
          personId: existing.id,
          source: input.acquisitionSource ?? existing.acquisitionSource,
          externalId: input.externalId ?? null,
          detail: input.acquisitionDetail ?? null,
          createdAt: now,
        };
        store.acquisitionEvents.unshift(acq);
        store.acquisitionEvents = store.acquisitionEvents.slice(0, 5000);
      }
      return;
    }

    created = true;
    const status = input.status ?? (input.marketingConsent ? "subscribed" : "pending");
    const person: MarketingPerson = {
      id: newId("mkt"),
      email: input.email.trim(),
      normalizedEmail,
      displayName: input.displayName ?? null,
      city: input.city ?? null,
      region: input.region ?? null,
      country: input.country ?? null,
      status,
      marketingConsent: Boolean(input.marketingConsent),
      consentAt: input.marketingConsent ? now : null,
      consentSource: input.marketingConsent ? input.consentSource ?? input.acquisitionSource ?? "manual" : null,
      acquisitionSource: input.acquisitionSource ?? "manual",
      acquisitionDetail: input.acquisitionDetail ?? null,
      tags: input.tags ?? [],
      mailchimpId: input.mailchimpId ?? null,
      suppressedAt: status === "unsubscribed" || status === "cleaned" ? now : null,
      bounceClass: null,
      createdAt: now,
      updatedAt: now,
    };
    store.people.unshift(person);
    personOut = person;

    store.acquisitionEvents.unshift({
      id: newId("acq"),
      personId: person.id,
      source: person.acquisitionSource,
      externalId: input.externalId ?? null,
      detail: input.acquisitionDetail ?? null,
      createdAt: now,
    });
    store.acquisitionEvents = store.acquisitionEvents.slice(0, 5000);
  });

  if (error) return { ok: false, error };
  if (!personOut) {
    // skipped preservation path still has personOut set; if somehow missing:
    const again = store.people.find((p) => p.normalizedEmail === normalizedEmail);
    if (!again) return { ok: false, error: "Upsert failed" };
    return { ok: true, person: again, created: false, skippedReason };
  }
  return { ok: true, person: personOut, created, skippedReason };
}

export async function listMarketingPeople(opts?: {
  q?: string;
  status?: MarketingStatus;
  limit?: number;
}): Promise<MarketingPerson[]> {
  const { store } = await readMarketingStore();
  let rows = store.people;
  if (opts?.status) rows = rows.filter((p) => p.status === opts.status);
  if (opts?.q?.trim()) {
    const q = opts.q.trim().toLowerCase();
    rows = rows.filter(
      (p) =>
        p.email.toLowerCase().includes(q) ||
        (p.displayName ?? "").toLowerCase().includes(q) ||
        (p.city ?? "").toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }
  const limit = opts?.limit ?? 500;
  return rows.slice(0, limit);
}

export async function getMarketingPerson(id: string): Promise<MarketingPerson | null> {
  const { store } = await readMarketingStore();
  return store.people.find((p) => p.id === id) ?? null;
}

export async function unsubscribePersonByEmail(email: string): Promise<MarketingPerson | null> {
  const normalizedEmail = normalizeMarketingEmail(email);
  if (!normalizedEmail) return null;
  let out: MarketingPerson | null = null;
  await updateMarketingStore((store) => {
    const person = store.people.find((p) => p.normalizedEmail === normalizedEmail);
    if (!person) return;
    const now = new Date().toISOString();
    person.status = "unsubscribed";
    person.marketingConsent = false;
    person.suppressedAt = now;
    person.updatedAt = now;
    out = person;
  });
  return out;
}
