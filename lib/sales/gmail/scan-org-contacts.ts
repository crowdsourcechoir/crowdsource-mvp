import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { getOrganization, listOrganizationMatchRows } from "@/lib/sales/db/organizations";
import { normalizeEmail } from "@/lib/sales/dedupe";
import { parseFromHeader } from "@/lib/sales/outreach/reply-correspondent";
import { saveOperatorContact } from "@/lib/sales/seed/add-manual";
import { getGmailClient } from "./client";
import {
  mergeContactSuggestions,
  readContactSuggestionStore,
  writeContactSuggestionStore,
  type GmailContactSuggestion,
} from "./contact-suggestion-store";
import { emailHost, proposeOrgContacts, type InboxPerson } from "./match-org-contacts";

export type GmailOrgContactScanResult = {
  skippedReason: string | null;
  messagesRead: number;
  peopleSeen: number;
  proposed: number;
  pending: number;
  error: string | null;
};

const DEFAULT_MAX_MESSAGES = 300;
const PAGE_SIZE = 100;

function headerValue(
  headers: { name?: string | null; value?: string | null }[] | undefined,
  name: string
): string | null {
  const hit = headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase());
  return hit?.value ?? null;
}

export function parseAddressList(header: string | null | undefined): { email: string | null; name: string | null }[] {
  if (!header?.trim()) return [];
  return header
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((part) => parseFromHeader(part))
    .filter((part) => part.email);
}

export function collectInboxPeople(
  messages: { from: string | null; to: string | null; cc: string | null; subject: string | null }[]
): InboxPerson[] {
  const byEmail = new Map<string, InboxPerson>();
  for (const message of messages) {
    const subject = (message.subject ?? "").trim();
    const addresses = [
      ...parseAddressList(message.from),
      ...parseAddressList(message.to),
      ...parseAddressList(message.cc),
    ];
    for (const address of addresses) {
      const email = normalizeEmail(address.email);
      if (!email) continue;
      const current = byEmail.get(email) ?? { email, fullName: null, subjects: [] };
      if (!current.fullName && address.name) current.fullName = address.name;
      if (subject && !current.subjects.includes(subject) && current.subjects.length < 4) {
        current.subjects.push(subject);
      }
      byEmail.set(email, current);
    }
  }
  return Array.from(byEmail.values());
}

async function existingContactKeys(pairs: { organizationId: string; email: string }[]): Promise<Set<string>> {
  const emails = Array.from(new Set(pairs.map((pair) => pair.email)));
  if (!emails.length) return new Set();
  const db = requireSupabaseAdmin();
  const found = new Set<string>();
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    const { data, error } = await db
      .from("contacts")
      .select("organization_id, normalized_email")
      .in("normalized_email", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const email = typeof row.normalized_email === "string" ? row.normalized_email : "";
      const organizationId = typeof row.organization_id === "string" ? row.organization_id : "";
      if (email && organizationId) found.add(`${organizationId}:${email}`);
    }
  }
  return found;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index]);
    }
  }
  const workers = Math.min(limit, items.length);
  if (workers > 0) {
    await Promise.all(Array.from({ length: workers }, () => worker()));
  }
  return out;
}

export async function scanGmailForOrgContacts(options?: {
  maxMessages?: number;
}): Promise<GmailOrgContactScanResult> {
  const empty = (skippedReason: string | null, error: string | null = null): GmailOrgContactScanResult => ({
    skippedReason,
    messagesRead: 0,
    peopleSeen: 0,
    proposed: 0,
    pending: 0,
    error,
  });

  const bundle = await getGmailClient();
  if (!bundle) return empty("Gmail is not connected.");

  const maxMessages = Math.min(500, Math.max(20, options?.maxMessages ?? DEFAULT_MAX_MESSAGES));
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < maxMessages) {
    const list = await bundle.gmail.users.messages.list({
      userId: "me",
      q: "newer_than:365d -in:chats -in:spam -in:trash",
      maxResults: Math.min(PAGE_SIZE, maxMessages - ids.length),
      pageToken,
    });
    for (const message of list.data.messages ?? []) {
      if (message.id) ids.push(message.id);
    }
    pageToken = list.data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }

  const headers = await mapPool(ids, 8, async (id) => {
    const full = await bundle.gmail.users.messages.get({
      userId: "me",
      id,
      format: "metadata",
      metadataHeaders: ["From", "To", "Cc", "Subject"],
    });
    const messageHeaders = full.data.payload?.headers;
    return {
      from: headerValue(messageHeaders, "From"),
      to: headerValue(messageHeaders, "To"),
      cc: headerValue(messageHeaders, "Cc"),
      subject: headerValue(messageHeaders, "Subject"),
    };
  });

  const people = collectInboxPeople(headers);
  const organizations = (await listOrganizationMatchRows()).filter((org) => !org.duplicateOfOrganizationId);
  const selfHost = emailHost(bundle.email);
  const freeHosts = new Set([
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "live.com",
    "icloud.com",
    "me.com",
  ]);
  const { store } = await readContactSuggestionStore({ skipCache: true });
  const taken = new Set(store.suggestions.filter((row) => row.status !== "pending").map((row) => row.id));
  const proposed = proposeOrgContacts({
    people,
    organizations,
    selfEmails: [bundle.email],
    skipDomains: selfHost && !freeHosts.has(selfHost) ? [selfHost] : [],
    takenKeys: taken,
  });
  const alreadyContacts = await existingContactKeys([
    ...proposed,
    ...store.suggestions
      .filter((row) => row.status === "pending")
      .map((row) => ({ organizationId: row.organizationId, email: row.email })),
  ]);
  const fresh = proposed.filter((row) => !alreadyContacts.has(row.id));
  const now = new Date().toISOString();
  const suggestions = mergeContactSuggestions(store.suggestions, fresh, now).map((row) =>
    row.status === "pending" && alreadyContacts.has(row.id) ? { ...row, status: "approved" as const } : row
  );
  const pending = suggestions.filter((row) => row.status === "pending").length;
  const write = await writeContactSuggestionStore({
    lastScannedAt: now,
    lastScanError: null,
    suggestions,
  });
  return {
    skippedReason: null,
    messagesRead: headers.length,
    peopleSeen: people.length,
    proposed: fresh.length,
    pending,
    error: write.error,
  };
}

export async function listPendingContactSuggestions(organizationId?: string | null): Promise<GmailContactSuggestion[]> {
  const { store } = await readContactSuggestionStore();
  return store.suggestions
    .filter((row) => row.status === "pending")
    .filter((row) => !organizationId || row.organizationId === organizationId)
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

const SCAN_INTERVAL_MS = 20 * 60 * 60 * 1000;

/** Daily-ish pass from the Gmail cron. Manual Scan inbox always runs. */
export async function scanGmailForOrgContactsIfStale(): Promise<GmailOrgContactScanResult | null> {
  const { store } = await readContactSuggestionStore();
  const last = store.lastScannedAt ? Date.parse(store.lastScannedAt) : 0;
  if (Number.isFinite(last) && Date.now() - last < SCAN_INTERVAL_MS) return null;
  return scanGmailForOrgContacts({ maxMessages: 160 });
}

export async function decideGmailContactSuggestion(
  id: string,
  action: "approve" | "dismiss"
): Promise<{ suggestion: GmailContactSuggestion; message: string }> {
  const { store, error } = await readContactSuggestionStore({ skipCache: true });
  if (error) throw new Error(error);
  const current = store.suggestions.find((row) => row.id === id);
  if (!current) throw new Error("Suggestion not found.");

  if (action === "dismiss") {
    const suggestion = { ...current, status: "dismissed" as const };
    const write = await writeContactSuggestionStore({
      ...store,
      suggestions: store.suggestions.map((row) => (row.id === id ? suggestion : row)),
    });
    if (write.error) throw new Error(write.error);
    return {
      suggestion,
      message: `Left ${current.fullName} off ${current.organizationName}.`,
    };
  }

  if (current.status === "approved" && current.contactId) {
    return {
      suggestion: current,
      message: `${current.fullName} is already on ${current.organizationName}.`,
    };
  }

  const organization = await getOrganization(current.organizationId);
  if (!organization) throw new Error("Organization not found.");
  const contact = await saveOperatorContact({
    organizationId: organization.id,
    fullName: current.fullName,
    email: current.email,
    trustEmail: true,
    extraMetadata: {
      gmailSuggestion: true,
      gmailMatchHow: current.matchHow,
      sampleSubject: current.sampleSubject,
    },
  });
  const suggestion = { ...current, status: "approved" as const, contactId: contact.id, organizationName: organization.name };
  const write = await writeContactSuggestionStore({
    ...store,
    suggestions: store.suggestions.map((row) => (row.id === id ? suggestion : row)),
  });
  if (write.error) throw new Error(write.error);
  return {
    suggestion,
    message: `Added ${contact.fullName ?? current.fullName} to ${organization.name}.`,
  };
}
