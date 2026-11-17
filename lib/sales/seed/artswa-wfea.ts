import {
  createContact,
  findExistingContact,
  listContactsForOrganization,
  updateContact,
} from "@/lib/sales/db/contacts";
import { findOrganizationTypeByKey } from "@/lib/sales/db/lookups";
import {
  getOpportunity,
  listOpportunitiesForOrganization,
  updateOpportunityImportMetadata,
  updateOpportunityRelationshipStage,
  updateOpportunityTouchTimestamps,
} from "@/lib/sales/db/opportunities";
import {
  createOrganization,
  findExistingOrganization,
  getOrganization,
  updateOrganization,
} from "@/lib/sales/db/organizations";
import { listDraftsForOpportunity, updateDraftAiCopy } from "@/lib/sales/db/outreach";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { followUpPresetIso } from "@/lib/sales/follow-up/calendar";
import { withSalesInitiative } from "@/lib/sales/initiatives";
import { enqueueOrgManually } from "@/lib/sales/seed/enqueue-manual";
import type { Contact, Organization } from "@/lib/sales/types";

export const ARTSWA_WFEA_SEEDED_FLAG = "artswaWfeaSeeded";

export const ARTSWA_WFEA_CARD = {
  organizationName: "ArtsWA (Washington State Arts Commission)",
  alternateNames: ["Washington State Arts Commission", "ArtsWA"] as const,
  websiteUrl: "https://www.arts.wa.gov",
  locationCity: "Olympia",
  locationRegion: "WA",
  locationCountry: "US",
  organizationTypeKey: "other",
  salesInitiative: "wfea_network" as const,
  eventName: "WFEA",
  contact: {
    fullName: "Aaron Semer",
    roleTitle: "Creative Districts Program Manager",
    roleCategory: "partnerships",
    email: "aaron.semer@arts.wa.gov",
    phone: "360-821-3840 (cell) | 360-252-9982 (office)",
    officePhone: "360-252-9982",
    cellPhone: "360-821-3840",
    mailingAddress: "711 Capitol Way South, Suite 600 | PO Box 42675, Olympia, WA 98504-2675",
    roleDescription:
      "Creative Districts Program Manager at ArtsWA (Washington State Arts Commission) — met at WFEA. Leads Washington's Certified Creative Districts network across cities and towns statewide; strong strategic partnership contact for connecting Crowdsource Choir Song Gardens, Anthems, and participatory activations with Creative Districts and community festivals.",
  },
  opportunity: {
    title: "ArtsWA — Creative Districts partnership (WFEA)",
    eventOrInitiativeName: "WFEA · Washington Creative Districts",
    opportunityTypeKey: "other",
    description:
      "Met Aaron Semer (Creative Districts Program Manager) at WFEA. Explore a strategic partnership with ArtsWA's Certified Creative Districts program — connecting Washington Creative Districts and festival communities with commissioned Song Gardens, Anthems, and participatory activations.",
    businessCategory: "commissioned" as const,
    productExperience: "custom_activation" as const,
    dealType: "strategic_partnership" as const,
    editionBloom: "Washington Creative Districts",
    revenueEngine: "partnership" as const,
    totalScoreHint: 86,
  },
} as const;

export function buildArtsWaWfeaDraft(): { subject: string; body: string } {
  return {
    subject: "Great meeting you at WFEA — Crowdsource Choir + Creative Districts",
    body: [
      "Hi Aaron,",
      "",
      "It was great meeting you at WFEA! I loved hearing about the work you're leading with ArtsWA's Certified Creative Districts across Washington.",
      "",
      "As a quick reminder, I'm Joel DeJong, founder of Crowdsource Choir — a participatory entertainment company based here in Washington where communities and audiences become the creators. Through digital Song Gardens and live participatory gatherings, local voices, stories, and sounds come together into original Anthems and shared artistic blooms.",
      "",
      "I'd love to explore what a partnership with the Creative Districts network could look like — whether introducing districts and local festival leaders to commissioned community Song Gardens and Anthems, or piloting a signature participatory moment with one of Washington's Creative Districts.",
      "",
      "Here's a short look at what we build:",
      "https://www.crowdsourcechoir.com/book",
      "",
      "Would you be open to a quick call in the next couple of weeks to trade ideas?",
      "",
      "Thanks, Aaron — great connecting with you!",
      "",
      "Best,",
      "Joel",
    ].join("\n"),
  };
}

export function buildArtsWaOrganizationMetadata(
  existing: Record<string, unknown> | null | undefined,
  nowIso: string = new Date().toISOString()
): Record<string, unknown> {
  const cardNote =
    "Met Aaron Semer (Creative Districts Program Manager) at WFEA — business card capture. Partnership doorway across Washington's Certified Creative Districts (commissioned Song Gardens, Anthems, and community festival activations).\n\nCard details: aaron.semer@arts.wa.gov | 360-252-9982 office | 360-821-3840 cell | 711 Capitol Way South, Suite 600, PO Box 42675, Olympia, WA 98504-2675 | www.arts.wa.gov";
  const priorNotes =
    typeof existing?.operatorNotes === "string" ? existing.operatorNotes.trim() : "";
  const operatorNotes =
    priorNotes && !priorNotes.includes("Aaron Semer")
      ? `${cardNote}\n\n---\n${priorNotes}`.slice(0, 4000)
      : priorNotes || cardNote;

  return withSalesInitiative(
    {
      ...(existing ?? {}),
      operatorNotes,
      wfeaNetwork: true,
      addedFromCardScan: true,
      source: "business_card_scan",
      eventName: ARTSWA_WFEA_CARD.eventName,
      revenueEngine: ARTSWA_WFEA_CARD.opportunity.revenueEngine,
      businessCategory: ARTSWA_WFEA_CARD.opportunity.businessCategory,
      productExperience: ARTSWA_WFEA_CARD.opportunity.productExperience,
      dealType: ARTSWA_WFEA_CARD.opportunity.dealType,
      searchTags: ["wfea", "partnership", "creative_districts", "artswa", "other"],
      [ARTSWA_WFEA_SEEDED_FLAG]: true,
      artswaWfeaSeededAt: nowIso,
    },
    ARTSWA_WFEA_CARD.salesInitiative
  );
}

export function buildArtsWaOpportunityMetadata(
  existing: Record<string, unknown> | null | undefined,
  nowIso: string = new Date().toISOString()
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    enqueuedManually: true,
    source: "business_card_scan",
    eventName: ARTSWA_WFEA_CARD.eventName,
    salesInitiative: ARTSWA_WFEA_CARD.salesInitiative,
    revenueEngine: ARTSWA_WFEA_CARD.opportunity.revenueEngine,
    businessCategory: ARTSWA_WFEA_CARD.opportunity.businessCategory,
    productExperience: ARTSWA_WFEA_CARD.opportunity.productExperience,
    dealType: ARTSWA_WFEA_CARD.opportunity.dealType,
    editionBloom: ARTSWA_WFEA_CARD.opportunity.editionBloom,
    [ARTSWA_WFEA_SEEDED_FLAG]: true,
    artswaWfeaSeededAt: nowIso,
  };
}

async function findArtsWaOrganization(): Promise<Organization | null> {
  const byPrimary = await findExistingOrganization(
    ARTSWA_WFEA_CARD.organizationName,
    ARTSWA_WFEA_CARD.websiteUrl
  );
  if (byPrimary) return byPrimary;
  for (const alt of ARTSWA_WFEA_CARD.alternateNames) {
    const found = await findExistingOrganization(alt, null);
    if (found) return found;
  }
  return null;
}

export type SeedArtsWaWfeaResult = {
  attempted: 1;
  createdOrg: boolean;
  updatedOrg: boolean;
  contactCreated: boolean;
  contactUpdated: boolean;
  enqueued: boolean;
  skippedAlreadySeeded: boolean;
  organizationId: string | null;
  contactId: string | null;
  opportunityId: string | null;
  queueItemId: string | null;
  relationshipStage: "interest" | null;
  nextFollowUpAt: string | null;
  error: string | null;
};

export async function seedArtsWaWfea(options?: { force?: boolean }): Promise<SeedArtsWaWfeaResult> {
  const force = Boolean(options?.force);
  const nowIso = new Date().toISOString();

  try {
    let existingOrg = await findArtsWaOrganization();
    if (!force && existingOrg) {
      const meta = (existingOrg.importMetadata ?? {}) as Record<string, unknown>;
      if (meta[ARTSWA_WFEA_SEEDED_FLAG] === true) {
        const opps = await listOpportunitiesForOrganization(existingOrg.id);
        const opp =
          opps.find(
            (o) =>
              o.title.toLowerCase() === ARTSWA_WFEA_CARD.opportunity.title.toLowerCase() ||
              (o.importMetadata as Record<string, unknown> | null)?.[ARTSWA_WFEA_SEEDED_FLAG] === true
          ) ?? opps[0] ?? null;
        return {
          attempted: 1,
          createdOrg: false,
          updatedOrg: false,
          contactCreated: false,
          contactUpdated: false,
          enqueued: false,
          skippedAlreadySeeded: true,
          organizationId: existingOrg.id,
          contactId: null,
          opportunityId: opp?.id ?? null,
          queueItemId: null,
          relationshipStage: (opp?.relationshipStage as "interest" | null) ?? null,
          nextFollowUpAt: opp?.nextFollowUpAt ?? null,
          error: null,
        };
      }
    }

    const orgType = await findOrganizationTypeByKey(ARTSWA_WFEA_CARD.organizationTypeKey);
    const orgMeta = buildArtsWaOrganizationMetadata(existingOrg?.importMetadata ?? null, nowIso);

    let createdOrg = false;
    let updatedOrg = false;
    let organization: Organization;

    if (!existingOrg) {
      organization = await createOrganization({
        name: ARTSWA_WFEA_CARD.organizationName,
        websiteUrl: ARTSWA_WFEA_CARD.websiteUrl,
        locationCity: ARTSWA_WFEA_CARD.locationCity,
        locationRegion: ARTSWA_WFEA_CARD.locationRegion,
        locationCountry: ARTSWA_WFEA_CARD.locationCountry,
        organizationTypeId: orgType?.id ?? null,
        source: "manual",
        isExistingClient: false,
        importMetadata: orgMeta,
      });
      createdOrg = true;
    } else {
      organization = await updateOrganization(existingOrg.id, {
        websiteUrl: existingOrg.websiteUrl ?? ARTSWA_WFEA_CARD.websiteUrl,
        locationCity: existingOrg.locationCity ?? ARTSWA_WFEA_CARD.locationCity,
        locationRegion: existingOrg.locationRegion ?? ARTSWA_WFEA_CARD.locationRegion,
        locationCountry: existingOrg.locationCountry ?? ARTSWA_WFEA_CARD.locationCountry,
        organizationTypeId: existingOrg.organizationTypeId ?? orgType?.id ?? null,
        importMetadata: orgMeta,
      });
      updatedOrg = true;
    }

    const c = ARTSWA_WFEA_CARD.contact;
    const contactMeta = {
      seededManually: true,
      source: "business_card_scan",
      eventName: ARTSWA_WFEA_CARD.eventName,
      officePhone: c.officePhone,
      cellPhone: c.cellPhone,
      mailingAddress: c.mailingAddress,
      roleDescription: c.roleDescription,
    };

    const existingContact = await findExistingContact(organization.id, c.email, c.fullName);
    let contact: Contact;
    let contactCreated = false;
    let contactUpdated = false;

    if (existingContact) {
      contact = await updateContact(existingContact.id, {
        fullName: c.fullName,
        roleTitle: c.roleTitle,
        roleCategory: c.roleCategory,
        email: c.email,
        phone: c.phone,
        emailVerificationStatus:
          existingContact.emailVerificationStatus === "verified_deliverable"
            ? "verified_deliverable"
            : "valid_format",
        importMetadata: {
          ...((existingContact.importMetadata as Record<string, unknown> | null) ?? {}),
          ...contactMeta,
        },
      });
      contactUpdated = true;
    } else {
      contact = await createContact({
        organizationId: organization.id,
        fullName: c.fullName,
        roleTitle: c.roleTitle,
        roleCategory: c.roleCategory,
        email: c.email,
        phone: c.phone,
        source: "manual",
        emailVerificationStatus: "valid_format",
        importMetadata: contactMeta,
      });
      contactCreated = true;
    }

    const manual = await enqueueOrgManually({
      organization,
      title: ARTSWA_WFEA_CARD.opportunity.title,
      description: ARTSWA_WFEA_CARD.opportunity.description,
      eventOrInitiativeName: ARTSWA_WFEA_CARD.opportunity.eventOrInitiativeName,
      opportunityTypeKey: ARTSWA_WFEA_CARD.opportunity.opportunityTypeKey,
      totalScoreHint: ARTSWA_WFEA_CARD.opportunity.totalScoreHint,
    });

    // Reload org so operatorQueuedAt written by enqueueOrgManually is preserved alongside our seed flag.
    const reloadedOrg = await getOrganization(organization.id);
    if (reloadedOrg) {
      await updateOrganization(organization.id, {
        importMetadata: buildArtsWaOrganizationMetadata(reloadedOrg.importMetadata, nowIso),
      });
    }

    const opp = await getOpportunity(manual.opportunityId);
    await updateOpportunityImportMetadata(
      manual.opportunityId,
      buildArtsWaOpportunityMetadata(opp?.importMetadata ?? null, nowIso)
    );
    await updateOpportunityRelationshipStage(manual.opportunityId, "interest");

    const nextFollowUpAt = opp?.nextFollowUpAt ?? followUpPresetIso("today");
    if (!opp?.nextFollowUpAt) {
      await updateOpportunityTouchTimestamps(manual.opportunityId, { nextFollowUpAt });
    }

    // Replace the generic fallback draft with a warm WFEA Creative Districts partnership note,
    // without touching any human edits Joel may have already saved.
    const customCopy = buildArtsWaWfeaDraft();
    const drafts = await listDraftsForOpportunity(manual.opportunityId);
    for (const draft of drafts) {
      if (
        draft.kind === "initial" &&
        draft.contactId === contact.id &&
        (draft.status === "draft" || draft.status === "qa_flagged") &&
        draft.editedSubject == null &&
        draft.editedBody == null
      ) {
        await updateDraftAiCopy(draft.id, {
          aiSubject: customCopy.subject,
          aiBody: customCopy.body,
        });
      }
    }

    return {
      attempted: 1,
      createdOrg,
      updatedOrg,
      contactCreated,
      contactUpdated,
      enqueued: true,
      skippedAlreadySeeded: false,
      organizationId: organization.id,
      contactId: contact.id,
      opportunityId: manual.opportunityId,
      queueItemId: manual.queueItemId,
      relationshipStage: "interest",
      nextFollowUpAt,
      error: null,
    };
  } catch (err) {
    return {
      attempted: 1,
      createdOrg: false,
      updatedOrg: false,
      contactCreated: false,
      contactUpdated: false,
      enqueued: false,
      skippedAlreadySeeded: false,
      organizationId: null,
      contactId: null,
      opportunityId: null,
      queueItemId: null,
      relationshipStage: null,
      nextFollowUpAt: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Public read-only status check (no email addresses exposed). */
export async function getArtsWaWfeaSeedStatus(): Promise<{
  expected: 1;
  present: boolean;
  markedSeeded: boolean;
  contactCount: number;
  queued: boolean;
  relationshipStage: string | null;
  done: boolean;
  organizationName: string;
}> {
  const existing = await findArtsWaOrganization();
  if (!existing) {
    return {
      expected: 1,
      present: false,
      markedSeeded: false,
      contactCount: 0,
      queued: false,
      relationshipStage: null,
      done: false,
      organizationName: ARTSWA_WFEA_CARD.organizationName,
    };
  }

  const meta = (existing.importMetadata ?? {}) as Record<string, unknown>;
  const markedSeeded = meta[ARTSWA_WFEA_SEEDED_FLAG] === true;
  const contacts = await listContactsForOrganization(existing.id);
  const activeContacts = contacts.filter((c) => !c.duplicateOfContactId);
  const opps = await listOpportunitiesForOrganization(existing.id);
  const targetOpp =
    opps.find(
      (o) =>
        o.title.toLowerCase() === ARTSWA_WFEA_CARD.opportunity.title.toLowerCase() ||
        (o.importMetadata as Record<string, unknown> | null)?.[ARTSWA_WFEA_SEEDED_FLAG] === true
    ) ?? opps[0] ?? null;

  let queued = false;
  if (targetOpp) {
    const db = requireSupabaseAdmin();
    const { count } = await db
      .from("approval_queue_items")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", targetOpp.id);
    queued = (count ?? 0) > 0;
  }

  return {
    expected: 1,
    present: true,
    markedSeeded,
    contactCount: activeContacts.length,
    queued,
    relationshipStage: targetOpp?.relationshipStage ?? null,
    done: markedSeeded && activeContacts.length >= 1 && queued,
    organizationName: existing.name,
  };
}
