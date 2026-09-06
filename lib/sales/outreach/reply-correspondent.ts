import { normalizeEmail } from "../dedupe";
import { replyKindFromActivity } from "./inbound-kind";

export type CorrespondentContact = {
  id: string;
  fullName: string | null;
  email: string | null;
  normalizedEmail?: string | null;
};

export type CorrespondentMatchHow = "email" | "name" | "snippet" | "activity";

export type CorrespondentMatch = {
  contactId: string;
  how: CorrespondentMatchHow;
};

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function nameKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** `"Kyle Hoob" <hoob@gonzaga.edu>` → name + email. */
export function parseFromHeader(from: string | null | undefined): { email: string | null; name: string | null } {
  if (!from?.trim()) return { email: null, name: null };
  const emailMatch = from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = emailMatch ? emailMatch[0].toLowerCase() : null;
  let name = from.replace(/<[^>]+>/g, "").replace(/"/g, "").trim();
  if (!name || (email && name.toLowerCase() === email) || name.includes("@")) {
    return { email, name: null };
  }
  return { email, name };
}

function emailOf(contact: CorrespondentContact): string | null {
  return normalizeEmail(contact.normalizedEmail || contact.email);
}

function matchByEmail(contacts: CorrespondentContact[], email: string | null | undefined): CorrespondentContact | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return contacts.find((contact) => emailOf(contact) === normalized) ?? null;
}

function matchByPersonName(contacts: CorrespondentContact[], name: string | null | undefined): CorrespondentContact | null {
  if (!name) return null;
  const key = nameKey(name);
  if (!key.includes(" ")) return null;
  const exact = contacts.filter((contact) => contact.fullName && nameKey(contact.fullName) === key);
  if (exact.length === 1) return exact[0];
  const contained = contacts
    .filter((contact) => {
      const full = contact.fullName ? nameKey(contact.fullName) : "";
      return full.includes(" ") && (key === full || key.includes(full) || full.includes(key));
    })
    .sort((a, b) => (b.fullName?.length ?? 0) - (a.fullName?.length ?? 0));
  return contained[0] ?? exact[0] ?? null;
}

function matchBySnippet(contacts: CorrespondentContact[], snippet: string | null | undefined): CorrespondentContact | null {
  if (!snippet) return null;
  const text = nameKey(decodeEntities(snippet));
  if (!text) return null;
  const hits = contacts
    .filter((contact) => {
      const full = contact.fullName ? nameKey(contact.fullName) : "";
      return full.includes(" ") && text.includes(full);
    })
    .sort((a, b) => (b.fullName?.length ?? 0) - (a.fullName?.length ?? 0));
  return hits[0] ?? null;
}

export function metadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isLiveReplyMetadata(metadata: Record<string, unknown> | null | undefined): boolean {
  return replyKindFromActivity({ metadata }) === "live";
}

/** Who actually wrote this inbound — not whoever we originally emailed. */
export function resolveCorrespondent(input: {
  contactId: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  snippet?: string | null;
  contacts: CorrespondentContact[];
}): CorrespondentMatch | null {
  const byEmail = matchByEmail(input.contacts, input.fromEmail);
  if (byEmail) return { contactId: byEmail.id, how: "email" };
  const byName = matchByPersonName(input.contacts, input.fromName);
  if (byName) return { contactId: byName.id, how: "name" };
  const bySnippet = matchBySnippet(input.contacts, input.snippet);
  if (bySnippet) return { contactId: bySnippet.id, how: "snippet" };
  if (input.contactId) return { contactId: input.contactId, how: "activity" };
  return null;
}

export function correspondentFromActivity(
  activity: { contactId: string | null; metadata: Record<string, unknown> | null },
  contacts: CorrespondentContact[]
): CorrespondentMatch | null {
  const metadata = activity.metadata;
  return resolveCorrespondent({
    contactId: activity.contactId,
    fromEmail: metadataString(metadata, "fromEmail"),
    fromName: metadataString(metadata, "fromName"),
    snippet: metadataString(metadata, "snippet"),
    contacts,
  });
}

/**
 * Walk live replies newest-first. Prefer a match from the From line or signature,
 * not the original send's contact_id (Peggy on a thread Kyle actually answered).
 */
export function latestLiveCorrespondent(
  activities: Array<{
    activityType: string;
    occurredAt: string;
    contactId: string | null;
    metadata: Record<string, unknown> | null;
  }>,
  contacts: CorrespondentContact[]
): CorrespondentMatch | null {
  const replies = activities
    .filter((activity) => activity.activityType === "replied" && isLiveReplyMetadata(activity.metadata))
    .slice()
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  let fallback: CorrespondentMatch | null = null;
  for (const reply of replies) {
    const match = correspondentFromActivity(reply, contacts);
    if (!match) continue;
    if (match.how !== "activity") return match;
    if (!fallback) fallback = match;
  }
  return fallback;
}
