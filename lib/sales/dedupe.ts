/** Normalization + duplicate-detection helpers shared by import scripts, the normalization stage, and API routes. */

import type { Contact } from "./types";

export function normalizeOrgName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function extractDomain(urlOrDomain: string | null | undefined): string | null {
  if (!urlOrDomain) return null;
  const trimmed = urlOrDomain.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const host = new URL(withProtocol).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  let trimmed = email.trim().toLowerCase();
  // Operators often leave trailing punctuation from typing mid-sentence or paste.
  trimmed = trimmed.replace(/[.,;:>\])}'"`]+$/g, "");
  if (trimmed === "null" || trimmed === "n/a" || trimmed === "none") return null; // guard against a model emitting the literal word instead of an actual null
  return trimmed.length > 0 && trimmed.includes("@") ? trimmed : null;
}

export function isPlausibleEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[A-Za-z0-9-]{2,}$/.test(normalized);
}

const GENERIC_MAILBOX_LOCAL_PARTS =
  /^(info|contact|admissions|admin|office|hello|support|general|frontdesk|front-desk|inquiries|inquiry|sales|help|events|event|fundraising|development|press|media|marketing|communications|comms|donations|donate|donor|giving|volunteer|volunteers|partners|partnership|partnerships|tickets|boxoffice|box-office|rsvp|booking|bookings|programming|sponsorship|sponsors|membership|members|outreach|community|team|mail|webmaster)$/i;

const GENERIC_ROLE_NAMES =
  /^(general mailbox|front ?desk|main office|admissions office|info desk|events? contact|events? (team|inbox)|general inbox|info inbox|info contact|office inbox)$/i;

/** Local part of an email, ignoring +tags (`events+gala@org.org` → `events`). */
export function emailLocalPart(email: string | null | undefined): string | null {
  if (!email || !email.includes("@")) return null;
  const local = email.trim().toLowerCase().split("@")[0] ?? "";
  const withoutPlus = local.split("+")[0] ?? local;
  return withoutPlus || null;
}

/**
 * Brand-suffixed departmental inboxes that are not a person's first.last address.
 * congress.whx@informa.com is the published WHX Dubai congress team inbox.
 */
const BRAND_DEPARTMENT_LOCAL_PARTS = /^(congress\.whx)$/i;

/** Shared departmental inboxes (info@, events@, …) — sendable without a named person. */
export function isGenericMailboxEmail(email: string | null | undefined): boolean {
  const local = emailLocalPart(email);
  if (!local) return false;
  return GENERIC_MAILBOX_LOCAL_PARTS.test(local) || BRAND_DEPARTMENT_LOCAL_PARTS.test(local);
}

export function looksLikeGenericRoleName(name: string | null | undefined): boolean {
  if (!name) return false;
  return GENERIC_ROLE_NAMES.test(name.trim());
}

/** Display name when the operator only typed an inbox address. */
export function genericMailboxLabel(email: string): string {
  const local = emailLocalPart(email) ?? "inbox";
  const titled = local.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `${titled} inbox`;
}

/**
 * True for an actual named human being (a real first + last name), false for a generic
 * departmental mailbox or role string with no attached person name (e.g. "info@org.com",
 * "General Mailbox", "Front Desk"). Used to keep the pipeline from treating a shared inbox as
 * if it were a named decision-maker. Operator-added general inboxes are still sendable via
 * `isSendableContact`.
 */
export function looksLikePersonName(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (trimmed.includes("@")) return false; // an email string is never itself a person's name
  if (!/\s/.test(trimmed)) return false; // require at least two words (first + last)
  if (looksLikeGenericRoleName(trimmed)) return false;
  return true;
}

/**
 * Hunter Email Verifier SMTP-ok bar for *named people* (UI checkmarks / scoring).
 * `valid_format` is only syntax; `risky` usually means catch-all / accept_all.
 * Outbound gating uses `isSendableContact` — Joel decides on soft Hunter results.
 */
export function hasVerifiedEmail(contact: Contact | null | undefined): boolean {
  if (!contact) return false;
  return contact.emailVerificationStatus === "verified_deliverable";
}

/**
 * Shown in the queue contact grid: named people with an email, or a general inbox.
 * Invalid / duplicate rows stay hidden from *selection for send* — see isQueueListedContact
 * for the wider grid (includes needs-email + bounce rows so Add contact always yields a card).
 */
export function isSelectableContact(contact: Contact | null | undefined): boolean {
  if (!contact?.email || !isPlausibleEmail(contact.email)) return false;
  if (contact.duplicateOfContactId) return false;
  if (contact.emailVerificationStatus === "invalid") return false;
  return looksLikePersonName(contact.fullName) || isGenericMailboxEmail(contact.email);
}

/**
 * Queue Contacts grid: every doorway Joel just added should appear as a card.
 * Includes named people still missing an email, and bounce-flagged addresses
 * (so Override is reachable). Duplicates stay hidden.
 */
export function isQueueListedContact(contact: Contact | null | undefined): boolean {
  if (!contact || contact.duplicateOfContactId) return false;
  if (contact.email && isPlausibleEmail(contact.email)) {
    return looksLikePersonName(contact.fullName) || isGenericMailboxEmail(contact.email);
  }
  return looksLikePersonName(contact.fullName);
}

/**
 * Ready to enqueue / draft / send: selectable contact that is not a known bounce.
 * Hunter `accept_all` / risky / unverified named people are allowed — Joel rejects
 * in the queue. Hard block remains `invalid` (+ outbound blocklist at call sites).
 */
export function isSendableContact(contact: Contact | null | undefined): boolean {
  return isSelectableContact(contact);
}

/** Greeting token: first name for a person, "there" for a shared inbox. */
export function contactGreetingName(
  contact: Pick<Contact, "fullName" | "email"> | null | undefined
): string {
  if (!contact) return "there";
  if (isGenericMailboxEmail(contact.email)) return "there";
  if (!looksLikePersonName(contact.fullName)) return "there";
  return contact.fullName!.trim().split(/\s+/)[0] || "there";
}

export function thanksSignOff(greetingName: string): string {
  return greetingName === "there" ? "Thanks!" : `Thanks, ${greetingName}!`;
}
