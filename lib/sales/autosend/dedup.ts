import { readCalendarStore } from "@/lib/sales/calendar/store";
import type { SyncedCalendarEvent } from "@/lib/sales/calendar/types";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { getGmailConnection } from "@/lib/sales/db/gmail";
import { normalizeEmail } from "@/lib/sales/dedupe";

const CHUNK = 150;
const CONTACTED_ACTIVITY_TYPES = new Set(["sent", "replied", "approved", "bounced"]);
const APPROVED_DRAFT_STATUSES = new Set(["approved", "approved_with_edits"]);

export type DedupOpportunityRow = {
  id: string;
  organization_id: string;
  last_outbound_at: string | null;
  last_inbound_at?: string | null;
  gmail_thread_id: string | null;
  relationship_stage?: string | null;
  status?: string | null;
};

export type DedupContactRow = {
  id: string;
  organization_id: string | null;
  email: string | null;
  normalized_email?: string | null;
};

export type DedupActivityRow = {
  opportunity_id: string;
  contact_id: string | null;
  activity_type: string;
  metadata: Record<string, unknown> | null;
};

export type DedupDraftRow = {
  opportunity_id: string;
  contact_id: string | null;
  status: string;
};

export type PriorOutreachIndex = {
  contactedOpportunityIds: Set<string>;
  contactedOrganizationIds: Set<string>;
  contactedContactIds: Set<string>;
  contactedEmails: Set<string>;
  meetingOpportunityIds: Set<string>;
  meetingOrganizationIds: Set<string>;
  meetingContactIds: Set<string>;
  meetingEmails: Set<string>;
};

function isContactedActivity(row: DedupActivityRow): boolean {
  if (CONTACTED_ACTIVITY_TYPES.has(row.activity_type)) return true;
  if (row.activity_type === "note" && row.metadata?.kind === "gmail_draft") return true;
  return false;
}

function addMetadataEmails(metadata: Record<string, unknown> | null, target: Set<string>): void {
  if (!metadata) return;
  const fromEmail = typeof metadata.fromEmail === "string" ? normalizeEmail(metadata.fromEmail) : null;
  if (fromEmail) target.add(fromEmail);
  if (Array.isArray(metadata.toEmails)) {
    for (const raw of metadata.toEmails) {
      if (typeof raw !== "string") continue;
      const email = normalizeEmail(raw);
      if (email) target.add(email);
    }
  }
}

export function buildPriorOutreachIndex(input: {
  opportunities: DedupOpportunityRow[];
  contacts: DedupContactRow[];
  activities: DedupActivityRow[];
  approvedDrafts: DedupDraftRow[];
  calendarEvents: SyncedCalendarEvent[];
  selfEmail?: string | null;
}): PriorOutreachIndex {
  const contactedOpportunityIds = new Set<string>();
  const contactedOrganizationIds = new Set<string>();
  const contactedContactIds = new Set<string>();
  const contactedEmails = new Set<string>();
  const meetingOpportunityIds = new Set<string>();
  const meetingOrganizationIds = new Set<string>();
  const meetingContactIds = new Set<string>();
  const meetingEmails = new Set<string>();

  const oppOrgById = new Map<string, string>();
  for (const opp of input.opportunities) {
    oppOrgById.set(opp.id, opp.organization_id);
    const touched = Boolean(
      opp.last_outbound_at ||
        opp.last_inbound_at ||
        opp.gmail_thread_id ||
        opp.relationship_stage ||
        opp.status === "approved"
    );
    if (touched) {
      contactedOpportunityIds.add(opp.id);
      if (opp.organization_id) contactedOrganizationIds.add(opp.organization_id);
    }
  }

  const emailByContactId = new Map<string, string>();
  const orgByContactId = new Map<string, string>();
  for (const contact of input.contacts) {
    const email = normalizeEmail(contact.normalized_email ?? contact.email);
    if (email) emailByContactId.set(contact.id, email);
    if (contact.organization_id) orgByContactId.set(contact.id, contact.organization_id);
  }

  for (const activity of input.activities) {
    if (!isContactedActivity(activity)) continue;
    contactedOpportunityIds.add(activity.opportunity_id);
    const oppOrg = oppOrgById.get(activity.opportunity_id);
    if (oppOrg) contactedOrganizationIds.add(oppOrg);
    if (activity.contact_id) {
      contactedContactIds.add(activity.contact_id);
      const email = emailByContactId.get(activity.contact_id);
      if (email) contactedEmails.add(email);
      const contactOrg = orgByContactId.get(activity.contact_id);
      if (contactOrg) contactedOrganizationIds.add(contactOrg);
    }
    addMetadataEmails(activity.metadata, contactedEmails);
  }

  for (const draft of input.approvedDrafts) {
    if (!APPROVED_DRAFT_STATUSES.has(draft.status)) continue;
    contactedOpportunityIds.add(draft.opportunity_id);
    const oppOrg = oppOrgById.get(draft.opportunity_id);
    if (oppOrg) contactedOrganizationIds.add(oppOrg);
    if (draft.contact_id) {
      contactedContactIds.add(draft.contact_id);
      const email = emailByContactId.get(draft.contact_id);
      if (email) contactedEmails.add(email);
      const contactOrg = orgByContactId.get(draft.contact_id);
      if (contactOrg) contactedOrganizationIds.add(contactOrg);
    }
  }

  const selfNormalized = normalizeEmail(input.selfEmail);
  for (const event of input.calendarEvents) {
    if (event.status === "cancelled") continue;
    if (event.source && event.source !== "google") continue;
    if (event.opportunityId) meetingOpportunityIds.add(event.opportunityId);
    if (event.organizationId) meetingOrganizationIds.add(event.organizationId);
    if (event.contactId) meetingContactIds.add(event.contactId);
    const rawEmails = [
      ...event.attendeeEmails,
      event.organizerEmail,
      event.contactEmail,
    ];
    for (const raw of rawEmails) {
      const normalized = normalizeEmail(raw);
      if (!normalized || normalized === selfNormalized) continue;
      meetingEmails.add(normalized);
    }
  }

  return {
    contactedOpportunityIds,
    contactedOrganizationIds,
    contactedContactIds,
    contactedEmails,
    meetingOpportunityIds,
    meetingOrganizationIds,
    meetingContactIds,
    meetingEmails,
  };
}

export function priorOutreachSkipReason(
  index: PriorOutreachIndex,
  candidate: {
    opportunityId: string;
    organizationId: string;
    contactId?: string | null;
    email?: string | null;
  }
): "meeting on calendar" | "already contacted" | null {
  const email = normalizeEmail(candidate.email);
  if (
    index.meetingOpportunityIds.has(candidate.opportunityId) ||
    index.meetingOrganizationIds.has(candidate.organizationId) ||
    (candidate.contactId && index.meetingContactIds.has(candidate.contactId)) ||
    (email && index.meetingEmails.has(email))
  ) {
    return "meeting on calendar";
  }

  if (
    index.contactedOpportunityIds.has(candidate.opportunityId) ||
    index.contactedOrganizationIds.has(candidate.organizationId) ||
    (candidate.contactId && index.contactedContactIds.has(candidate.contactId)) ||
    (email && index.contactedEmails.has(email))
  ) {
    return "already contacted";
  }

  return null;
}

async function fetchChunks<T>(
  values: string[],
  run: (chunk: string[]) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const unique = Array.from(new Set(values.filter(Boolean)));
  const out: T[] = [];
  for (let index = 0; index < unique.length; index += CHUNK) {
    const { data, error } = await run(unique.slice(index, index + CHUNK));
    if (error) throw new Error(error.message);
    if (data) out.push(...data);
  }
  return out;
}

export async function loadPriorOutreachIndex(seed: {
  organizationIds: string[];
  contactIds: string[];
  emails: string[];
}): Promise<PriorOutreachIndex> {
  const db = requireSupabaseAdmin();
  const normalizedEmails = Array.from(
    new Set(seed.emails.map((email) => normalizeEmail(email)).filter((email): email is string => Boolean(email)))
  );

  const [orgContacts, emailContacts, idContacts, calendarResult, gmailConnection] = await Promise.all([
    seed.organizationIds.length
      ? fetchChunks<DedupContactRow>(seed.organizationIds, async (chunk) =>
          db
            .from("contacts")
            .select("id, organization_id, email, normalized_email")
            .in("organization_id", chunk)
        )
      : Promise.resolve([]),
    normalizedEmails.length
      ? fetchChunks<DedupContactRow>(normalizedEmails, async (chunk) =>
          db
            .from("contacts")
            .select("id, organization_id, email, normalized_email")
            .in("normalized_email", chunk)
        )
      : Promise.resolve([]),
    seed.contactIds.length
      ? fetchChunks<DedupContactRow>(seed.contactIds, async (chunk) =>
          db
            .from("contacts")
            .select("id, organization_id, email, normalized_email")
            .in("id", chunk)
        )
      : Promise.resolve([]),
    readCalendarStore().catch(() => ({ store: { events: [] as SyncedCalendarEvent[] } })),
    getGmailConnection().catch(() => null),
  ]);

  const contactById = new Map<string, DedupContactRow>();
  for (const row of [...orgContacts, ...emailContacts, ...idContacts]) {
    contactById.set(row.id, row);
  }
  const contacts = Array.from(contactById.values());

  const allOrgIds = Array.from(
    new Set([
      ...seed.organizationIds,
      ...contacts.map((c) => c.organization_id).filter((id): id is string => Boolean(id)),
    ])
  );
  const allContactIds = Array.from(new Set([...seed.contactIds, ...contacts.map((c) => c.id)]));

  const opportunities = allOrgIds.length
    ? await fetchChunks<DedupOpportunityRow>(allOrgIds, async (chunk) =>
        db
          .from("opportunities")
          .select(
            "id, organization_id, last_outbound_at, last_inbound_at, gmail_thread_id, relationship_stage, status"
          )
          .in("organization_id", chunk)
      )
    : [];
  const allOpportunityIds = opportunities.map((opp) => opp.id);

  const [oppActivities, contactActivities, approvedDrafts] = await Promise.all([
    allOpportunityIds.length
      ? fetchChunks<DedupActivityRow>(allOpportunityIds, async (chunk) =>
          db
            .from("outreach_activities")
            .select("opportunity_id, contact_id, activity_type, metadata")
            .in("opportunity_id", chunk)
            .in("activity_type", ["sent", "replied", "approved", "bounced", "note"])
        )
      : Promise.resolve([]),
    allContactIds.length
      ? fetchChunks<DedupActivityRow>(allContactIds, async (chunk) =>
          db
            .from("outreach_activities")
            .select("opportunity_id, contact_id, activity_type, metadata")
            .in("contact_id", chunk)
            .in("activity_type", ["sent", "replied", "approved", "bounced", "note"])
        )
      : Promise.resolve([]),
    allContactIds.length
      ? fetchChunks<DedupDraftRow>(allContactIds, async (chunk) =>
          db
            .from("outreach_drafts")
            .select("opportunity_id, contact_id, status")
            .in("contact_id", chunk)
            .in("status", ["approved", "approved_with_edits"])
        )
      : Promise.resolve([]),
  ]);

  return buildPriorOutreachIndex({
    opportunities,
    contacts,
    activities: [...oppActivities, ...contactActivities],
    approvedDrafts,
    calendarEvents: calendarResult.store.events,
    selfEmail: gmailConnection?.email ?? null,
  });
}
