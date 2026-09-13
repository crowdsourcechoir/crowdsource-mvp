/**
 * Per-org Hunter budget: prefer net-new orgs over deep-mining one contact grid.
 *
 * Domain Search = 1 credit per 1–10 emails. Verifier = 0.5 per completed check.
 * Cap: top 3 Hunter-sourced contacts and ≤3 credits spent finding them.
 */

import type { Contact, Organization } from "@/lib/sales/types";

export const MAX_HUNTER_CONTACTS_PER_ORG = 3;
export const MAX_HUNTER_CREDITS_PER_ORG = 3;

const SENIORITY_RANK: Record<string, number> = {
  executive: 100,
  "c-suite": 100,
  founder: 95,
  owner: 95,
  partner: 90,
  vp: 85,
  "vice president": 85,
  director: 70,
  head: 65,
  senior: 50,
  manager: 40,
  lead: 35,
  mid: 20,
  junior: 10,
  entry: 5,
};

export function isHunterSourcedContact(contact: Contact): boolean {
  const meta = contact.importMetadata;
  if (meta && (meta.hunterDomainSearch === true || typeof meta.hunterQuery === "string")) {
    return true;
  }
  return contact.source === "ai_discovered" && Boolean(meta?.hunterDomainSearch);
}

export function countHunterSourcedContacts(contacts: Contact[]): number {
  return contacts.filter(isHunterSourcedContact).length;
}

export function hunterCreditsSpentOnOrg(org: Organization): number {
  const raw = org.importMetadata?.hunterCreditsSpent;
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export function hunterContactSlotsRemaining(contacts: Contact[]): number {
  return Math.max(0, MAX_HUNTER_CONTACTS_PER_ORG - countHunterSourcedContacts(contacts));
}

export function hunterCreditBudgetRemaining(org: Organization): number {
  return Math.max(0, MAX_HUNTER_CREDITS_PER_ORG - hunterCreditsSpentOnOrg(org));
}

export function withHunterCreditsSpent(
  meta: Record<string, unknown> | null | undefined,
  additionalCredits: number
): Record<string, unknown> {
  const prev = typeof meta?.hunterCreditsSpent === "number" ? meta.hunterCreditsSpent : 0;
  return {
    ...(meta ?? {}),
    hunterCreditsSpent: Math.round((prev + Math.max(0, additionalCredits)) * 10) / 10,
    hunterCreditsUpdatedAt: new Date().toISOString(),
  };
}

function titleSeniorityBonus(position: string | null | undefined): number {
  if (!position) return 0;
  const p = position.toLowerCase();
  let bonus = 0;
  if (/\b(chief|ceo|coo|cfo|cmo|cto|president)\b/.test(p)) bonus += 40;
  if (/\b(vp|vice\s*president)\b/.test(p)) bonus += 30;
  if (/\b(director|head\s+of)\b/.test(p)) bonus += 20;
  if (/\b(senior)\b/.test(p)) bonus += 8;
  if (/\b(manager)\b/.test(p)) bonus += 5;
  if (/\b(specialist|coordinator|assistant|associate)\b/.test(p)) bonus -= 15;
  return bonus;
}

/** Higher = better (executive / decision-maker first). */
export function hunterPersonRank(person: {
  seniority?: string | null;
  position?: string | null;
  confidence?: number | null;
}): number {
  const seniorityKey = (person.seniority ?? "").trim().toLowerCase();
  const seniorityScore = SENIORITY_RANK[seniorityKey] ?? 0;
  const confidence = typeof person.confidence === "number" ? person.confidence : 0;
  return seniorityScore + titleSeniorityBonus(person.position) + confidence / 100;
}

export function pickTopHunterPeople<T extends { seniority?: string | null; position?: string | null; confidence?: number | null }>(
  people: T[],
  limit: number
): T[] {
  if (limit <= 0) return [];
  return [...people]
    .sort((a, b) => hunterPersonRank(b) - hunterPersonRank(a))
    .slice(0, limit);
}
