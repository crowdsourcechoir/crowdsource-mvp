import {
  createContact,
  findExistingContact,
  listContactsForOrganization,
  updateContact,
} from "@/lib/sales/db/contacts";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { findOpportunityTypeByKey, findOrganizationTypeByKey } from "@/lib/sales/db/lookups";
import {
  createOpportunity,
  listOpportunitiesForOrganization,
  updateOpportunityRelationshipStage,
} from "@/lib/sales/db/opportunities";
import {
  createOrganization,
  findExistingOrganization,
  updateOrganization,
} from "@/lib/sales/db/organizations";
import {
  createOutreachDraft,
  listDraftsForOpportunity,
  updateDraftAiCopy,
} from "@/lib/sales/db/outreach";
import { createPipelineRun, updatePipelineRun } from "@/lib/sales/db/pipeline";
import {
  createOrUpdateQueueItem,
  getInitialQueueItemByOpportunity,
} from "@/lib/sales/db/queue";
import { createProspectScore } from "@/lib/sales/db/scores";
import { resolveBusinessModelFromMetadata } from "@/lib/sales/business-model";
import { resolveFlagshipOffer, resolveRevenueEngine } from "@/lib/sales/engines";
import { readSalesInitiative } from "@/lib/sales/initiatives";
import { computeTotalScore } from "@/lib/sales/scoring/score";
import { classifyWorkstream } from "@/lib/sales/strategy/playbook";
import {
  EE_FUNDRAISING_CONTACTS,
  EE_FUNDRAISING_EVENT_NAME,
  EE_FUNDRAISING_NAME,
  EE_FUNDRAISING_OPPORTUNITY_DESCRIPTION,
  EE_FUNDRAISING_OPPORTUNITY_TITLE,
  EE_FUNDRAISING_SEEDED_FLAG,
  EE_FUNDRAISING_WEBSITE,
  WFEA_OCR_BLEED_PHONE,
  buildEeFundraisingDraftCopy,
  buildEeFundraisingPartnershipMetadata,
  type EeFundraisingContactSpec,
} from "@/lib/sales/seed/ee-fundraising-partnership";
import {
  SCORE_COMPONENT_KEYS,
  type Contact,
  type Opportunity,
  type Organization,
  type OutreachDraft,
  type ScoreComponentKey,
} from "@/lib/sales/types";

export type SeedEeFundraisingPartnershipResult = {
  ok: boolean;
  skipped: boolean;
  createdOrganization: boolean;
  organizationId: string | null;
  organizationName: string | null;
  opportunityId: string | null;
  queueItemId: string | null;
  primaryContactName: string | null;
  relationshipStage: string | null;
  dealType: string | null;
  workstream: string | null;
  contactsCreated: number;
  contactsUpdated: number;
  contactCount: number;
  error: string | null;
};

function preserveVerificationStatus(
  existing: Contact | null,
  fallback: Contact["emailVerificationStatus"]
): Contact["emailVerificationStatus"] {
  const current = existing?.emailVerificationStatus;
  if (current === "verified_deliverable" || current === "invalid" || current === "risky") {
    return current;
  }
  return fallback;
}

async function findEeOrganization(): Promise<Organization | null> {
  const byPrimary = await findExistingOrganization(EE_FUNDRAISING_NAME, EE_FUNDRAISING_WEBSITE);
  if (byPrimary) return byPrimary;
  return findExistingOrganization(EE_FUNDRAISING_NAME, "https://www.eefundraising.com");
}

async function upsertEeContact(
  organizationId: string,
  spec: EeFundraisingContactSpec,
  nowIso: string
): Promise<{ contact: Contact; created: boolean }> {
  const existing = await findExistingContact(organizationId, spec.email, spec.fullName);
  const status = preserveVerificationStatus(existing, spec.emailVerificationStatus);
  const importMetadata: Record<string, unknown> = {
    ...(existing?.importMetadata ?? {}),
    seededManually: true,
    eeFundraisingPartnership: true,
    roleDescription: spec.roleDescription,
    publishedReach: true,
    smtpChecked: status === "verified_deliverable",
    ...(spec.primary
      ? {
          source: "business_card_scan",
          scannedAt: nowIso,
          eventName: EE_FUNDRAISING_EVENT_NAME,
        }
      : {}),
  };

  if (existing) {
    const cleanedExistingPhone =
      existing.phone?.replace(/\s+/g, "") === WFEA_OCR_BLEED_PHONE ? null : existing.phone;
    const contact = await updateContact(existing.id, {
      fullName: spec.fullName,
      roleTitle: spec.roleTitle,
      roleCategory: spec.roleCategory,
      email: spec.email,
      phone: spec.phone ?? cleanedExistingPhone,
      emailVerificationStatus: status,
      importMetadata,
    });
    return { contact, created: false };
  }

  const contact = await createContact({
    organizationId,
    fullName: spec.fullName,
    roleTitle: spec.roleTitle,
    roleCategory: spec.roleCategory,
    email: spec.email,
    phone: spec.phone,
    source: "manual",
    emailVerificationStatus: status,
    importMetadata,
  });
  return { contact, created: true };
}

function isLegacySportsFallbackBody(body: string | null | undefined): boolean {
  if (!body) return false;
  return /game-day moment|student-athletes|season-long pipeline of crowdsourced chants/i.test(body);
}

async function ensurePartnershipDraftForContact(input: {
  opportunityId: string;
  pipelineRunId: string;
  contact: Contact;
  forceRefreshUnedited?: boolean;
}): Promise<OutreachDraft> {
  const existing = await listDraftsForOpportunity(input.opportunityId);
  const candidates = existing
    .filter((d) => d.kind === "initial" && d.contactId === input.contact.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const copy = buildEeFundraisingDraftCopy(input.contact.fullName ?? "there");
  const open = candidates.find((d) => d.status === "draft" || d.status === "qa_flagged" || d.status === "qa_passed");
  if (open) {
    const unedited = open.editedBody == null && open.editedSubject == null;
    if (unedited && (input.forceRefreshUnedited || isLegacySportsFallbackBody(open.aiBody))) {
      return updateDraftAiCopy(open.id, {
        aiSubject: copy.subject,
        aiBody: copy.body,
      });
    }
    return open;
  }

  const alreadyHandled = candidates.find(
    (d) => d.status === "approved" || d.status === "approved_with_edits" || d.status === "rejected"
  );
  if (alreadyHandled) return alreadyHandled;

  return createOutreachDraft({
    opportunityId: input.opportunityId,
    contactId: input.contact.id,
    pipelineRunId: input.pipelineRunId,
    kind: "initial",
    status: "draft",
    confidenceScore: 0.85,
    aiSubject: copy.subject,
    aiBody: copy.body,
  });
}

async function upsertPartnershipOpportunity(input: {
  organizationId: string;
  opportunityTypeId: string | null;
  primaryRoleTitle: string;
  nowIso: string;
}): Promise<Opportunity> {
  const existing = await listOpportunitiesForOrganization(input.organizationId);
  const reusable =
    existing.find((opp) => opp.title.toLowerCase() === EE_FUNDRAISING_OPPORTUNITY_TITLE.toLowerCase()) ??
    existing.find((opp) => !opp.lastOutboundAt && !opp.gmailThreadId) ??
    null;

  if (!reusable) {
    const created = await createOpportunity({
      organizationId: input.organizationId,
      opportunityTypeId: input.opportunityTypeId,
      title: EE_FUNDRAISING_OPPORTUNITY_TITLE,
      eventOrInitiativeName: EE_FUNDRAISING_EVENT_NAME,
      description: EE_FUNDRAISING_OPPORTUNITY_DESCRIPTION,
      status: "ready_for_review",
      targetContactRoleHint: input.primaryRoleTitle,
      importMetadata: buildEeFundraisingPartnershipMetadata(null, {
        enqueuedManually: true,
        eeFundraisingPartnershipSeededAt: input.nowIso,
      }),
    });
    return updateOpportunityRelationshipStage(created.id, "interest");
  }

  const db = requireSupabaseAdmin();
  const nextMeta = buildEeFundraisingPartnershipMetadata(reusable.importMetadata, {
    enqueuedManually: true,
    eeFundraisingPartnershipSeededAt: input.nowIso,
  });
  const keepStage =
    reusable.relationshipStage === "purchase" ? "purchase" : "interest";
  const { data, error } = await db
    .from("opportunities")
    .update({
      opportunity_type_id: input.opportunityTypeId ?? reusable.opportunityTypeId,
      title: EE_FUNDRAISING_OPPORTUNITY_TITLE,
      event_or_initiative_name: EE_FUNDRAISING_EVENT_NAME,
      description: EE_FUNDRAISING_OPPORTUNITY_DESCRIPTION,
      status: reusable.lastOutboundAt ? reusable.status : "ready_for_review",
      target_contact_role_hint: input.primaryRoleTitle,
      relationship_stage: keepStage,
      stage_updated_at: input.nowIso,
      import_metadata: nextMeta,
      updated_at: input.nowIso,
    })
    .eq("id", reusable.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return {
    ...reusable,
    opportunityTypeId: (data.opportunity_type_id as string | null) ?? null,
    title: data.title as string,
    eventOrInitiativeName: (data.event_or_initiative_name as string | null) ?? null,
    description: (data.description as string | null) ?? null,
    status: data.status as Opportunity["status"],
    targetContactRoleHint: (data.target_contact_role_hint as string | null) ?? null,
    relationshipStage: data.relationship_stage as Opportunity["relationshipStage"],
    stageUpdatedAt: data.stage_updated_at as string | null,
    importMetadata: (data.import_metadata as Record<string, unknown> | null) ?? null,
  };
}

/**
 * Idempotent upsert of E + E Fundraising & Events into Strategic Partnership + Queue,
 * with Liz DeBord (WFEA 2026 Annual Conference badge) as the primary queued contact.
 */
export async function seedEeFundraisingPartnership(options?: {
  force?: boolean;
}): Promise<SeedEeFundraisingPartnershipResult> {
  const force = Boolean(options?.force);
  const nowIso = new Date().toISOString();

  let organization = await findEeOrganization();
  const existingMeta = (organization?.importMetadata ?? {}) as Record<string, unknown>;
  if (organization && !force && existingMeta[EE_FUNDRAISING_SEEDED_FLAG] === true) {
    const status = await getEeFundraisingPartnershipStatus();
    return {
      ok: true,
      skipped: true,
      createdOrganization: false,
      organizationId: organization.id,
      organizationName: organization.name,
      opportunityId: status.opportunityId,
      queueItemId: status.queueItemId,
      primaryContactName: status.primaryContactName,
      relationshipStage: status.relationshipStage,
      dealType: status.dealType,
      workstream: status.workstream,
      contactsCreated: 0,
      contactsUpdated: 0,
      contactCount: status.contactCount,
      error: null,
    };
  }

  const orgType =
    (await findOrganizationTypeByKey("event_agency")) ??
    (await findOrganizationTypeByKey("other"));
  const oppType =
    (await findOpportunityTypeByKey("fundraising_gala")) ??
    (await findOpportunityTypeByKey("other"));

  const priorNotes =
    typeof existingMeta.operatorNotes === "string" ? existingMeta.operatorNotes.trim() : "";
  const badgeNote =
    "Met Liz DeBord (Event Production & Management) in person at WFEA 2026 Annual Conference — strategic partnership lead for nonprofit galas and fundraising events.";
  const operatorNotes = priorNotes.includes("Liz DeBord")
    ? priorNotes
    : priorNotes
      ? `${badgeNote}\n\n---\n${priorNotes}`.slice(0, 4000)
      : badgeNote;

  let createdOrganization = false;
  if (!organization) {
    organization = await createOrganization({
      name: EE_FUNDRAISING_NAME,
      websiteUrl: EE_FUNDRAISING_WEBSITE,
      locationCity: "Bellevue",
      locationRegion: "WA",
      locationCountry: "US",
      organizationTypeId: orgType?.id ?? null,
      source: "manual",
      isExistingClient: false,
      importMetadata: buildEeFundraisingPartnershipMetadata(null, {
        operatorNotes,
        operatorQueuedAt: nowIso,
        [EE_FUNDRAISING_SEEDED_FLAG]: true,
        eeFundraisingPartnershipSeededAt: nowIso,
      }),
    });
    createdOrganization = true;
  } else {
    organization = await updateOrganization(organization.id, {
      name: EE_FUNDRAISING_NAME,
      websiteUrl: EE_FUNDRAISING_WEBSITE,
      locationCity: organization.locationCity ?? "Bellevue",
      locationRegion: organization.locationRegion ?? "WA",
      locationCountry: organization.locationCountry ?? "US",
      organizationTypeId: orgType?.id ?? organization.organizationTypeId,
      importMetadata: buildEeFundraisingPartnershipMetadata(organization.importMetadata, {
        operatorNotes,
        operatorQueuedAt: nowIso,
        [EE_FUNDRAISING_SEEDED_FLAG]: true,
        eeFundraisingPartnershipSeededAt: nowIso,
      }),
    });
  }

  let contactsCreated = 0;
  let contactsUpdated = 0;
  const upsertedContacts: Contact[] = [];
  for (const spec of EE_FUNDRAISING_CONTACTS) {
    const res = await upsertEeContact(organization.id, spec, nowIso);
    if (res.created) contactsCreated += 1;
    else contactsUpdated += 1;
    upsertedContacts.push(res.contact);
  }

  const lizContact =
    upsertedContacts.find((c) => c.email?.toLowerCase() === "liz@eefundraising.com") ??
    upsertedContacts[0]!;

  const opportunity = await upsertPartnershipOpportunity({
    organizationId: organization.id,
    opportunityTypeId: oppType?.id ?? null,
    primaryRoleTitle: lizContact.roleTitle ?? "Event Production & Management",
    nowIso,
  });

  const pipelineRun = await createPipelineRun(organization.id, "manual");
  const rawScores = {} as Record<
    ScoreComponentKey,
    { score: number; rationale: string; findingIds: string[] }
  >;
  for (const key of SCORE_COMPONENT_KEYS) {
    rawScores[key] = {
      score: 8,
      rationale: `WFEA 2026 Annual Conference partnership lead for ${EE_FUNDRAISING_NAME}.`,
      findingIds: [],
    };
  }
  rawScores.decision_maker_access.score = 9;
  rawScores.contact_quality.score = 9;
  rawScores.participatory_program_fit.score = 9;
  rawScores.strategic_value.score = 9;
  const { total, components } = computeTotalScore(rawScores);

  const score = await createProspectScore({
    opportunityId: opportunity.id,
    pipelineRunId: pipelineRun.id,
    totalScore: total,
    componentScores: components,
    rationale:
      "Met Liz DeBord at WFEA 2026 Annual Conference. E + E Fundraising & Events produces 60+ nonprofit galas and auctions across Washington ($14M+ raised) — high-leverage strategic partner for recurring Anthem placements.",
    confidence: "high",
    missingInformation: [
      "liz@eefundraising.com is published on PRWeb (Nov 2, 2026) — SMTP verification pending Hunter monthly credit reset.",
    ],
    model: "manual",
  });

  const lizDraft = await ensurePartnershipDraftForContact({
    opportunityId: opportunity.id,
    pipelineRunId: pipelineRun.id,
    contact: lizContact,
    forceRefreshUnedited: true,
  });

  for (const other of upsertedContacts) {
    if (other.id === lizContact.id) continue;
    await ensurePartnershipDraftForContact({
      opportunityId: opportunity.id,
      pipelineRunId: pipelineRun.id,
      contact: other,
      forceRefreshUnedited: false,
    });
  }

  const queueItem = await createOrUpdateQueueItem({
    opportunityId: opportunity.id,
    outreachDraftId: lizDraft.id,
    prospectScoreId: score.id,
    duplicateWarning: false,
    reopenDecided: !opportunity.lastOutboundAt,
    touchCreatedAt: true,
  });

  await updatePipelineRun(pipelineRun.id, {
    status: "succeeded",
    currentStage: "queue",
    finishedAt: nowIso,
  });

  const allContacts = await listContactsForOrganization(organization.id);
  const revenueEngine = resolveRevenueEngine(opportunity.importMetadata, organization.importMetadata);
  const flagshipOffer = resolveFlagshipOffer(opportunity.importMetadata, organization.importMetadata);
  const salesInitiative = readSalesInitiative(organization.importMetadata);
  const workstream = classifyWorkstream({
    revenueEngine,
    flagshipOffer,
    salesInitiative,
    organizationTypeKey: "event_agency",
  });
  const businessModel = resolveBusinessModelFromMetadata(
    opportunity.importMetadata,
    organization.importMetadata,
    {
      revenueEngine,
      flagshipOffer,
      salesInitiative,
      organizationTypeKey: "event_agency",
      workstream,
      opportunityTitle: opportunity.title,
    }
  );

  return {
    ok: true,
    skipped: false,
    createdOrganization,
    organizationId: organization.id,
    organizationName: organization.name,
    opportunityId: opportunity.id,
    queueItemId: queueItem.id,
    primaryContactName: lizContact.fullName,
    relationshipStage: opportunity.relationshipStage,
    dealType: businessModel.dealType,
    workstream,
    contactsCreated,
    contactsUpdated,
    contactCount: allContacts.filter((c) => !c.duplicateOfContactId).length,
    error: null,
  };
}

/** Public read-only status (names, stages, and counts only — never returns email addresses). */
export async function getEeFundraisingPartnershipStatus(): Promise<{
  present: boolean;
  markedSeeded: boolean;
  done: boolean;
  organizationName: string | null;
  contactCount: number;
  contactNames: string[];
  opportunityId: string | null;
  queueItemId: string | null;
  queueStatus: string | null;
  primaryContactName: string | null;
  relationshipStage: string | null;
  dealType: string | null;
  workstream: string | null;
}> {
  const organization = await findEeOrganization();
  if (!organization) {
    return {
      present: false,
      markedSeeded: false,
      done: false,
      organizationName: null,
      contactCount: 0,
      contactNames: [],
      opportunityId: null,
      queueItemId: null,
      queueStatus: null,
      primaryContactName: null,
      relationshipStage: null,
      dealType: null,
      workstream: null,
    };
  }

  const meta = (organization.importMetadata ?? {}) as Record<string, unknown>;
  const markedSeeded = meta[EE_FUNDRAISING_SEEDED_FLAG] === true;
  const contacts = (await listContactsForOrganization(organization.id)).filter(
    (c) => !c.duplicateOfContactId
  );
  const contactNames = contacts.map((c) => c.fullName).filter((n): n is string => Boolean(n));
  const opportunities = await listOpportunitiesForOrganization(organization.id);
  const opportunity =
    opportunities.find(
      (opp) => opp.title.toLowerCase() === EE_FUNDRAISING_OPPORTUNITY_TITLE.toLowerCase()
    ) ??
    opportunities[0] ??
    null;

  let queueItemId: string | null = null;
  let queueStatus: string | null = null;
  let primaryContactName: string | null = null;

  if (opportunity) {
    const item = await getInitialQueueItemByOpportunity(opportunity.id);
    if (item) {
      queueItemId = item.id;
      queueStatus = item.status;
      if (item.outreachDraftId) {
        const drafts = await listDraftsForOpportunity(opportunity.id);
        const activeDraft = drafts.find((d) => d.id === item.outreachDraftId);
        const matched = activeDraft?.contactId
          ? contacts.find((c) => c.id === activeDraft.contactId)
          : null;
        primaryContactName = matched?.fullName ?? null;
      }
    }
  }

  const revenueEngine = resolveRevenueEngine(opportunity?.importMetadata, organization.importMetadata);
  const flagshipOffer = resolveFlagshipOffer(opportunity?.importMetadata, organization.importMetadata);
  const salesInitiative = readSalesInitiative(organization.importMetadata);
  const workstream = classifyWorkstream({
    revenueEngine,
    flagshipOffer,
    salesInitiative,
    organizationTypeKey: "event_agency",
  });
  const businessModel = resolveBusinessModelFromMetadata(
    opportunity?.importMetadata,
    organization.importMetadata,
    {
      revenueEngine,
      flagshipOffer,
      salesInitiative,
      organizationTypeKey: "event_agency",
      workstream,
      opportunityTitle: opportunity?.title,
    }
  );

  const hasLiz = contactNames.some((n) => n.toLowerCase() === "liz debord");
  const done =
    markedSeeded &&
    hasLiz &&
    Boolean(queueItemId) &&
    primaryContactName?.toLowerCase() === "liz debord";

  return {
    present: true,
    markedSeeded,
    done,
    organizationName: organization.name,
    contactCount: contacts.length,
    contactNames,
    opportunityId: opportunity?.id ?? null,
    queueItemId,
    queueStatus,
    primaryContactName,
    relationshipStage: opportunity?.relationshipStage ?? null,
    dealType: businessModel.dealType,
    workstream,
  };
}
