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
  const trimmed = email.trim().toLowerCase();
  if (trimmed === "null" || trimmed === "n/a" || trimmed === "none") return null; // guard against a model emitting the literal word instead of an actual null
  return trimmed.length > 0 && trimmed.includes("@") ? trimmed : null;
}

export function isPlausibleEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

const GENERIC_MAILBOX_LOCAL_PARTS = /^(info|contact|admissions|admin|office|hello|support|general|frontdesk|front-desk|inquiries|inquiry|sales|help)$/i;

/**
 * True for an actual named human being (a real first + last name), false for a generic
 * departmental mailbox or role string with no attached person name (e.g. "info@org.com",
 * "General Mailbox", "Front Desk"). Used to keep the pipeline from treating a shared inbox as
 * if it were a named decision-maker.
 */
export function looksLikePersonName(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (trimmed.includes("@")) {
    const localPart = trimmed.split("@")[0];
    if (GENERIC_MAILBOX_LOCAL_PARTS.test(localPart)) return false;
    return false; // an email string is never itself a person's name, generic or not
  }
  if (!/\s/.test(trimmed)) return false; // require at least two words (first + last)
  if (/^(general mailbox|front ?desk|main office|admissions office|info desk)$/i.test(trimmed)) return false;
  return true;
}

/**
 * "Verified enough to actually send to" bar used to gate queue entry (see run-pipeline.ts and
 * docs/sales-platform/ai-workflow.md §4/§10) — `valid_format` (format + domain checks out) or
 * `verified_deliverable` (a future live-probe result, not yet produced by v1's stage 5, but
 * accepted here so this gate doesn't need a code change once that lands). `risky` and
 * `unverified` don't clear the bar: a human shouldn't be asked to approve outreach to an address
 * the pipeline itself isn't confident is real.
 *
 * Clicking a contact already shown in the approval queue is a different bar — see
 * `hasSelectableOutreachEmail`. That click is the human override this gate describes.
 */
export function hasVerifiedEmail(contact: Contact | null | undefined): boolean {
  if (!contact) return false;
  return contact.emailVerificationStatus === "valid_format" || contact.emailVerificationStatus === "verified_deliverable";
}

/**
 * Bar for switching the active queue draft to a contact the picker already showed.
 * Format-valid emails still count when stage 5 marked them `risky` (typical for NCAA
 * athletics: staff mail is @university.edu while the org domain is a Sidearm host like
 * gohuskies.com). `invalid` does not count.
 */
export function hasSelectableOutreachEmail(contact: Contact | null | undefined): boolean {
  if (!contact?.email) return false;
  if (contact.emailVerificationStatus === "invalid") return false;
  return isPlausibleEmail(contact.email);
}
