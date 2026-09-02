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
 * docs/sales-platform/ai-workflow.md §4/§10) — Hunter Email Verifier must return a live
 * SMTP-ok result (`verified_deliverable`). `valid_format` is only a syntax + org-domain check
 * and was letting undeliverable mailboxes into the queue (bounces). `risky` and `unverified`
 * never clear the bar.
 */
export function hasVerifiedEmail(contact: Contact | null | undefined): boolean {
  if (!contact) return false;
  return contact.emailVerificationStatus === "verified_deliverable";
}
