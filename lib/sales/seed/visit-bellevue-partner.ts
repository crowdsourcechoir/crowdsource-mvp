import { listActivitiesForOpportunity } from "@/lib/sales/db/activities";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import {
  createContact,
  findExistingContact,
  listContactsForOrganization,
  updateContact,
} from "@/lib/sales/db/contacts";
import { findOrganizationTypeByKey } from "@/lib/sales/db/lookups";
import {
  getOpportunity,
  updateOpportunityImportMetadata,
  updateOpportunityRelationshipStage,
} from "@/lib/sales/db/opportunities";
import { listDraftsForOpportunity, updateDraftAiCopy } from "@/lib/sales/db/outreach";
import {
  createOrganization,
  findExistingOrganization,
  getOrganization,
  updateOrganization,
} from "@/lib/sales/db/organizations";
import { getQueueItemByOpportunity, setQueueItemOutreachDraft } from "@/lib/sales/db/queue";
import { isSendableContact, normalizeEmail } from "@/lib/sales/dedupe";
import { withRevenueEngine } from "@/lib/sales/engines";
import { verifyEmailAddress } from "@/lib/sales/enrichment/verify-email";
import { syncGmailCorrespondence } from "@/lib/sales/gmail/sync";
import { enqueueOrgManually } from "@/lib/sales/seed/enqueue-manual";
import { listPitchAdmin, updatePitch } from "@/lib/pitches/service";
import { CONFERENCE_BELLEVUE_ID, VISIT_BELLEVUE_ID } from "@/lib/pitches/model";
import { siteUrl } from "@/lib/site-url";
import type { Contact } from "@/lib/sales/types";

const ORG_NAME = "Visit Bellevue";
const WEBSITE = "https://www.visitbellevue.com";
const PRESENTATION_ID = VISIT_BELLEVUE_ID;
const CONFERENCE_PITCH_ID = CONFERENCE_BELLEVUE_ID;
const CONFERENCE_PITCH_SLUG = "conference-pitch-bellevue";

const CONTACTS: {
  fullName: string;
  email: string;
  roleTitle: string;
  phone: string | null;
  notes: string;
}[] = [
  {
    fullName: "Celestina Hendrickson",
    email: "chendrickson@visitbellevue.com",
    roleTitle: "Tourism Development, Event Services",
    phone: null,
    notes: "CTA. She/Her. Kirkland, Washington. Primary contact.",
  },
  {
    fullName: "Meredith Langridge Anderson",
    email: "mlangridge@visitbellevue.com",
    roleTitle: "Director of Visitor Experience",
    phone: "877.425.2075 x702",
    notes: "From Visit Bellevue card.",
  },
  {
    fullName: "Brad Jones",
    email: "BJones@visitbellevue.com",
    roleTitle: "Executive Director",
    phone: "877.425.2075 x700",
    notes: "From Visit Bellevue card.",
  },
];

function pitchUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

function partnershipDraft(firstName: string, followUp: boolean): { subject: string; body: string } {
  const presentation = pitchUrl("/pitch/visit-bellevue");
  const conference = pitchUrl(`/pitch/${CONFERENCE_PITCH_SLUG}`);
  if (followUp) {
    return {
      subject: "Visit Bellevue × Crowdsource Choir",
      body: `Hi ${firstName},\n\nFollowing up on our note. I put two things in one place for Visit Bellevue:\n\nPartnership presentation: ${presentation}\nConference pitch: ${conference}\n\nHappy to walk through either whenever it's useful.\n\nBest,\nJoel`,
    };
  }
  return {
    subject: "Visit Bellevue × Crowdsource Choir",
    body: `Hi ${firstName},\n\nI hope you're doing well!\n\nI'm Joel DeJong, founder of Crowdsource Choir. I'd love to explore a partnership with Visit Bellevue — participatory entertainment where visitors become part of the story, not just an audience for it.\n\nPartnership presentation: ${presentation}\nConference pitch: ${conference}\n\nIf it feels like a fit, I'd love to connect — or be pointed to whoever should see this.\n\nBest,\nJoel`,
  };
}

async function upsertContact(organizationId: string, input: (typeof CONTACTS)[number]): Promise<Contact> {
  const email = normalizeEmail(input.email);
  if (!email) throw new Error(`Missing email for ${input.fullName}.`);
  const existing = await findExistingContact(organizationId, email, input.fullName);
  let status: Contact["emailVerificationStatus"] = existing?.emailVerificationStatus ?? "unverified";
  if (!existing || status === "unverified") {
    const verified = await verifyEmailAddress(email);
    status = verified.status === "unverified" ? "valid_format" : verified.status;
  }
  const meta = {
    ...((existing?.importMetadata as Record<string, unknown> | null) ?? {}),
    roleDescription: input.notes,
    visitBellevuePartner: true,
  };
  if (existing) {
    return updateContact(existing.id, {
      fullName: input.fullName,
      roleTitle: input.roleTitle,
      email,
      phone: input.phone,
      emailVerificationStatus: status,
      importMetadata: meta,
    });
  }
  return createContact({
    organizationId,
    fullName: input.fullName,
    roleTitle: input.roleTitle,
    email,
    phone: input.phone,
    source: "manual",
    emailVerificationStatus: status,
    importMetadata: meta,
  });
}

async function linkPitch(id: string, organizationId: string, label: string): Promise<string> {
  const listed = await listPitchAdmin();
  if (listed.error) throw new Error(listed.error);
  const current = listed.pitches.find((pitch) => pitch.id === id);
  if (!current) throw new Error(`${label} is missing.`);
  if (current.organizationId === organizationId.toLowerCase()) return current.href;
  const saved = await updatePitch(id, { organizationId });
  if (saved.error || !saved.pitch) throw new Error(saved.error ?? `Could not connect ${label}.`);
  if (saved.pitch.organizationId !== organizationId.toLowerCase()) {
    throw new Error(`${label} did not stay connected to Visit Bellevue.`);
  }
  return saved.pitch.href;
}

async function linkPitches(organizationId: string): Promise<{
  presentationLinked: boolean;
  conferencePitchId: string | null;
  conferencePitchHref: string | null;
}> {
  const presentationHref = await linkPitch(PRESENTATION_ID, organizationId, "the Visit Bellevue presentation");
  const conferenceHref = await linkPitch(CONFERENCE_PITCH_ID, organizationId, "Conference Pitch: Bellevue");
  return {
    presentationLinked: Boolean(presentationHref),
    conferencePitchId: CONFERENCE_PITCH_ID,
    conferencePitchHref: conferenceHref,
  };
}

export type VisitBellevueSeedStatus = {
  present: boolean;
  queued: boolean;
  partner: boolean;
  presentationLinked: boolean;
  conferencePitchLinked: boolean;
  conferencePitchHref: string | null;
  contactCount: number;
  correspondenceCount: number;
};

export async function getVisitBellevueSeedStatus(): Promise<VisitBellevueSeedStatus> {
  const organization = await findExistingOrganization(ORG_NAME, WEBSITE);
  if (!organization) {
    return {
      present: false,
      queued: false,
      partner: false,
      presentationLinked: false,
      conferencePitchLinked: false,
      conferencePitchHref: null,
      contactCount: 0,
      correspondenceCount: 0,
    };
  }
  const engine = (organization.importMetadata?.revenueEngine as string | undefined) ?? null;
  const contacts = await listContactsForOrganization(organization.id);
  const listed = await listPitchAdmin(organization.id);
  const presentationLinked = listed.pitches.some((pitch) => pitch.id === PRESENTATION_ID);
  const conference = listed.pitches.find((pitch) => pitch.id === CONFERENCE_PITCH_ID);
  const opportunityId = await findOpportunityId(organization.id);
  const queue = opportunityId ? await getQueueItemByOpportunity(opportunityId) : null;
  let correspondenceCount = 0;
  if (opportunityId) {
    const activities = await listActivitiesForOpportunity(opportunityId);
    correspondenceCount = activities.filter((activity) => activity.gmailMessageId).length;
  }
  return {
    present: true,
    queued: queue?.status === "pending",
    partner: engine === "partnership",
    presentationLinked,
    conferencePitchLinked: Boolean(conference),
    conferencePitchHref: conference?.href ?? null,
    contactCount: contacts.length,
    correspondenceCount,
  };
}

async function findOpportunityId(organizationId: string): Promise<string | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("opportunities")
    .select("id, title")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; title: string | null }[];
  return (rows.find((row) => row.title === ORG_NAME) ?? rows[0])?.id ?? null;
}

export async function seedVisitBellevuePartner(): Promise<{
  organizationId: string;
  queueItemId: string | null;
  contactNames: string[];
  primaryContact: string | null;
  presentationLinked: boolean;
  conferencePitchHref: string | null;
  gmail: {
    skippedReason: string | null;
    searched: number;
    repliesRecorded: number;
    outboundsRecorded: number;
    bouncesRecorded: number;
    subjects: string[];
    errors: string[];
  };
}> {
  const orgType = await findOrganizationTypeByKey("destination_marketing_organization");
  let organization = await findExistingOrganization(ORG_NAME, WEBSITE);
  const metadata = withRevenueEngine(
    {
      ...((organization?.importMetadata as Record<string, unknown> | null) ?? {}),
      visitBellevuePartner: true,
      addedFromQueue: true,
    },
    "partnership"
  );
  if (!organization) {
    organization = await createOrganization({
      name: ORG_NAME,
      websiteUrl: WEBSITE,
      locationCity: "Bellevue",
      locationRegion: "WA",
      locationCountry: "US",
      organizationTypeId: orgType?.id ?? null,
      source: "manual",
      importMetadata: metadata,
    });
  } else {
    organization = await updateOrganization(organization.id, {
      name: ORG_NAME,
      websiteUrl: WEBSITE,
      locationCity: organization.locationCity ?? "Bellevue",
      locationRegion: organization.locationRegion ?? "WA",
      locationCountry: organization.locationCountry ?? "US",
      organizationTypeId: orgType?.id ?? organization.organizationTypeId,
      importMetadata: metadata,
    });
  }

  const contacts: Contact[] = [];
  for (const input of CONTACTS) {
    contacts.push(await upsertContact(organization.id, input));
  }
  const primary =
    contacts.find((contact) => normalizeEmail(contact.email) === "chendrickson@visitbellevue.com") ?? contacts[0];
  if (!primary || !isSendableContact(primary)) {
    const blocked = contacts.map((contact) => `${contact.fullName}: ${contact.emailVerificationStatus}`).join("; ");
    throw new Error(`Celestina is not sendable, so Visit Bellevue was not queued. ${blocked}`);
  }

  let opportunityId = await findOpportunityId(organization.id);
  const existingQueue = opportunityId ? await getQueueItemByOpportunity(opportunityId) : null;
  let queueItemId = existingQueue?.status === "pending" ? existingQueue.id : null;
  if (!queueItemId) {
    const queued = await enqueueOrgManually({
      organization,
      title: ORG_NAME,
      description:
        "Destination partnership. Celestina Hendrickson is the doorway. Presentation and conference pitch are linked.",
      opportunityTypeKey: "other",
      totalScoreHint: 84,
    });
    opportunityId = queued.opportunityId;
    queueItemId = queued.queueItemId;
  }
  if (!opportunityId || !queueItemId) throw new Error("Visit Bellevue did not land in the queue.");

  const opportunity = await getOpportunity(opportunityId);
  if (opportunity) {
    await updateOpportunityImportMetadata(
      opportunity.id,
      withRevenueEngine(
        {
          ...(opportunity.importMetadata ?? {}),
          visitBellevuePartner: true,
        },
        "partnership"
      )
    );
  }

  const pitches = await linkPitches(organization.id);
  const gmail = await syncGmailCorrespondence({
    opportunityId,
    emails: contacts.map((contact) => contact.email ?? "").filter(Boolean),
  });

  const hasReply = gmail.repliesRecorded > 0;
  const hasOutbound = gmail.outboundsRecorded > 0;
  if (hasReply) await updateOpportunityRelationshipStage(opportunityId, "interest");
  else if (hasOutbound) await updateOpportunityRelationshipStage(opportunityId, "awareness");

  const drafts = await listDraftsForOpportunity(opportunityId);
  const primaryDraft =
    drafts.find(
      (draft) => draft.contactId === primary.id && (draft.status === "draft" || draft.status === "qa_flagged")
    ) ?? null;
  if (primaryDraft) {
    const queueItem = await getQueueItemByOpportunity(opportunityId);
    if (queueItem?.status === "pending" && queueItem.outreachDraftId !== primaryDraft.id) {
      await setQueueItemOutreachDraft(queueItem.id, primaryDraft.id);
    }
  }
  if (primaryDraft && !primaryDraft.editedBody) {
    const firstName = primary.fullName?.trim().split(/\s+/)[0] || "Celestina";
    const followUp = hasReply || hasOutbound;
    const copy = partnershipDraft(firstName, followUp);
    const current = primaryDraft.aiBody ?? "";
    const missingLinks = !current.includes("/pitch/visit-bellevue") || !current.includes("Conference pitch:");
    const stillColdOpen = followUp && !current.includes("Following up");
    if (missingLinks || stillColdOpen) {
      await updateDraftAiCopy(primaryDraft.id, {
        aiSubject: copy.subject,
        aiBody: copy.body,
      });
    }
  }

  if (!gmail.skippedReason) {
    organization = (await getOrganization(organization.id)) ?? organization;
    await updateOrganization(organization.id, {
      importMetadata: {
        ...(organization.importMetadata ?? {}),
        gmailCorrespondenceSyncedAt: new Date().toISOString(),
      },
    });
  }

  return {
    organizationId: organization.id,
    queueItemId,
    contactNames: contacts.map((contact) => contact.fullName ?? contact.email ?? "contact"),
    primaryContact: primary.fullName,
    presentationLinked: pitches.presentationLinked,
    conferencePitchHref: pitches.conferencePitchHref,
    gmail: {
      skippedReason: gmail.skippedReason,
      searched: gmail.searched,
      repliesRecorded: gmail.repliesRecorded,
      outboundsRecorded: gmail.outboundsRecorded,
      bouncesRecorded: gmail.bouncesRecorded,
      subjects: gmail.subjects,
      errors: gmail.errors,
    },
  };
}
