import { listContactsByNormalizedEmail } from "../db/contacts";
import { getOrganization } from "../db/organizations";
import { requireSupabaseAdmin } from "../db/client";
import { normalizeEmail } from "../dedupe";
import type { CalendarMatchStatus } from "./types";

export type CalendarMatch = {
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  organizationId: string | null;
  organizationName: string | null;
  opportunityId: string | null;
  matchStatus: CalendarMatchStatus;
};

async function findOpenOpportunityForOrg(organizationId: string): Promise<string | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("opportunities")
    .select("id")
    .eq("organization_id", organizationId)
    .not("relationship_stage", "is", null)
    .neq("relationship_stage", "lost")
    .neq("relationship_stage", "purchase")
    .order("last_outbound_at", { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0]?.id as string | undefined) ?? null;
}

/**
 * Match a meeting to a CRM contact by attendee email.
 * Skips Joel's connected Google account; prefers the first known contact among attendees.
 */
export async function matchMeetingAttendees(input: {
  attendeeEmails: string[];
  organizerEmail: string | null;
  selfEmail: string;
}): Promise<CalendarMatch> {
  const self = normalizeEmail(input.selfEmail);
  const candidates = [...input.attendeeEmails, input.organizerEmail]
    .filter((e): e is string => Boolean(e))
    .map((e) => normalizeEmail(e))
    .filter((e): e is string => Boolean(e) && e !== self);

  const unique = Array.from(new Set(candidates));
  if (unique.length === 0) {
    return {
      contactId: null,
      contactName: null,
      contactEmail: null,
      organizationId: null,
      organizationName: null,
      opportunityId: null,
      matchStatus: "self_only",
    };
  }

  for (const email of unique) {
    const contacts = await listContactsByNormalizedEmail(email);
    const contact = contacts[0];
    if (!contact) continue;

    const org = contact.organizationId ? await getOrganization(contact.organizationId) : null;
    const opportunityId = contact.organizationId
      ? await findOpenOpportunityForOrg(contact.organizationId)
      : null;

    return {
      contactId: contact.id,
      contactName: contact.fullName || contact.email,
      contactEmail: contact.email,
      organizationId: contact.organizationId,
      organizationName: org?.name ?? null,
      opportunityId,
      matchStatus: "matched",
    };
  }

  return {
    contactId: null,
    contactName: null,
    contactEmail: unique[0] ?? null,
    organizationId: null,
    organizationName: null,
    opportunityId: null,
    matchStatus: "unmatched",
  };
}
