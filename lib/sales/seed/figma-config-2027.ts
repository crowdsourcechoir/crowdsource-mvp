import { refreshAutoSendPlan } from "@/lib/sales/autosend/tick";
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
  listOpportunitiesForOrganization,
  updateOpportunityImportMetadata,
} from "@/lib/sales/db/opportunities";
import {
  createOrganization,
  findExistingOrganization,
  getOrganization,
  updateOrganization,
} from "@/lib/sales/db/organizations";
import { listDraftsForOpportunity, updateDraftAiCopy } from "@/lib/sales/db/outreach";
import { createOrUpdateQueueItem } from "@/lib/sales/db/queue";
import { withSalesInitiative } from "@/lib/sales/initiatives";
import { PRICING_FRAMEWORK_VERSION } from "@/lib/sales/pricing/metadata";
import { enqueueOrgManually } from "@/lib/sales/seed/enqueue-manual";
import type { Contact, Organization } from "@/lib/sales/types";

export const FIGMA_CONFIG_SEEDED_FLAG = "figmaConfig2027Seeded";

export type FigmaConfigContactSpec = {
  fullName: string;
  email: string;
  roleTitle: string;
  roleCategory: string;
  linkedinUrl: string;
  emailVerificationStatus: Contact["emailVerificationStatus"];
  hunterVerifier: string;
  hunterConfidence: number;
  primary: boolean;
  roleDescription: string;
};

export const FIGMA_CONFIG_2027_SPEC = {
  organizationName: "Figma Config",
  alternateNames: ["Figma", "Config 2027", "Figma Config 2027"] as const,
  websiteUrl: "https://www.figma.com",
  eventWebsiteUrl: "https://config.figma.com/",
  locationCity: "San Francisco",
  locationRegion: "CA",
  locationCountry: "US",
  organizationTypeKey: "conference",
  salesInitiative: "tech_conferences" as const,
  hunterCreditsSpent: 2,
  opportunity: {
    title: "Figma Config 2027 — Pier 80 San Francisco (May 25–27) participatory anthem",
    eventOrInitiativeName: "Figma Config 2027",
    eventDateEstimate: "2027-05-25",
    eventDateConfidence: "confirmed" as const,
    opportunityTypeKey: "annual_conference",
    description:
      "Figma's flagship annual conference for people who build products — May 25–27, 2027 at Pier 80 in San Francisco, CA (8,000+ in-person attendees, 75+ speakers, 50+ sessions, keynotes, brand activations, Config Commons, and the invite-only Leadership Collective; early bird passes $600 / $1,200 full price; agenda announced April 2027). Strong creative fit for an original Crowdsource Choir Anthem or mainstage participatory creation moment where 8,000 builders co-create together. Event page: https://config.figma.com/",
    suggestedAnthemFee: 30_000,
    pricingCategory: "conference" as const,
    pricingTier: "flagship_global" as const,
    businessCategory: "commissioned" as const,
    productExperience: "anthem" as const,
    dealType: "client_booking" as const,
    revenueEngine: "premium" as const,
    flagshipOffer: "anthem_experience" as const,
    totalScoreHint: 90,
  },
  contacts: [
    {
      fullName: "Azra Daniels",
      email: "adaniels@figma.com",
      roleTitle: "Director, Experiential Marketing",
      roleCategory: "marketing",
      linkedinUrl: "https://www.linkedin.com/in/azradaniels",
      emailVerificationStatus: "verified_deliverable",
      hunterVerifier: "valid",
      hunterConfidence: 95,
      primary: true,
      roleDescription:
        "Director of Experiential Marketing at Figma — leads flagship experiential strategy and live brand moments (Config at Pier 80). Verified deliverable via Hunter SMTP check (score 100).",
    },
    {
      fullName: "Kelley Sauer",
      email: "ksauer@figma.com",
      roleTitle: "Manager, Experiential Events",
      roleCategory: "events",
      linkedinUrl: "https://www.linkedin.com/in/theksauer",
      emailVerificationStatus: "verified_deliverable",
      hunterVerifier: "valid",
      hunterConfidence: 95,
      primary: false,
      roleDescription:
        "Manager of Experiential Events at Figma — hands-on experiential event producer for flagship live programming and activations. Verified deliverable via Hunter SMTP check (score 100).",
    },
    {
      fullName: "Rosalys Bryan",
      email: "rbryan@figma.com",
      roleTitle: "Experiential Events",
      roleCategory: "events",
      linkedinUrl: "https://www.linkedin.com/in/rosalys-bryan-05a6345b",
      emailVerificationStatus: "risky",
      hunterVerifier: "unknown",
      hunterConfidence: 95,
      primary: false,
      roleDescription:
        "Experiential Events team at Figma (Hunter confidence 95; SMTP check returned unknown/greylisted, marked catch-all/risky so Azra and Kelley lead outreach).",
    },
  ] satisfies FigmaConfigContactSpec[],
} as const;

export function buildFigmaConfigDraft(contactFullName: string): {
  subject: string;
  body: string;
} {
  const firstName = contactFullName.trim().split(/\s+/)[0] || "there";
  return {
    subject: "Crowdsource Choir + Config 2027 at Pier 80",
    body: [
      `Hi ${firstName},`,
      "",
      "I hope you're doing well!",
      "",
      "I'm Joel DeJong, founder of Crowdsource Choir — a participatory musical experience where the audience becomes the choir. With Config 2027 coming to Pier 80 on May 25–27, I wanted to reach out because a room of 8,000 people who love building feels like a remarkable match for what we create.",
      "",
      "We turn attendees from spectators into collaborators: builders contribute their voices, ideas, and sounds ahead of time or in the room, and we shape those contributions into an original Config anthem that everyone at Pier 80 performs together live — whether as a keynote opener, a Config Commons activation, or a closing moment.",
      "",
      "Here's a quick look at the experience:",
      "www.crowdsourcechoir.com",
      "",
      "If it feels like it could be a fit as Config 2027 programming comes together, I'd love to schedule a quick call — or be pointed toward whoever on the team shapes mainstage and experiential moments.",
      "",
      `Thanks, ${firstName}!`,
      "",
      "Best,",
      "Joel",
    ].join("\n"),
  };
}

export function buildFigmaConfigOrgMetadata(
  existing: Record<string, unknown> | null | undefined,
  nowIso: string = new Date().toISOString()
): Record<string, unknown> {
  const note =
    "Figma Config 2027 — May 25–27, 2027 at Pier 80 in San Francisco, CA (https://config.figma.com/). 8,000+ in-person attendees, 75+ speakers, 50+ sessions, Config Commons activations, and Leadership Collective; early bird tickets $600 (50% off $1,200). Contacts sourced & verified via Hunter on figma.com (Azra Daniels, Director of Experiential Marketing; Kelley Sauer, Manager of Experiential Events; Rosalys Bryan, Experiential Events).";
  const priorNotes =
    typeof existing?.operatorNotes === "string" ? existing.operatorNotes.trim() : "";
  const operatorNotes =
    priorNotes && !priorNotes.includes("Pier 80")
      ? `${note}\n\n---\n${priorNotes}`.slice(0, 4000)
      : priorNotes || note;

  return withSalesInitiative(
    {
      ...(existing ?? {}),
      operatorNotes,
      eventWebsiteUrl: FIGMA_CONFIG_2027_SPEC.eventWebsiteUrl,
      revenueEngine: FIGMA_CONFIG_2027_SPEC.opportunity.revenueEngine,
      flagshipOffer: FIGMA_CONFIG_2027_SPEC.opportunity.flagshipOffer,
      businessCategory: FIGMA_CONFIG_2027_SPEC.opportunity.businessCategory,
      productExperience: FIGMA_CONFIG_2027_SPEC.opportunity.productExperience,
      dealType: FIGMA_CONFIG_2027_SPEC.opportunity.dealType,
      hunterCreditsSpent:
        typeof existing?.hunterCreditsSpent === "number"
          ? Math.max(existing.hunterCreditsSpent, FIGMA_CONFIG_2027_SPEC.hunterCreditsSpent)
          : FIGMA_CONFIG_2027_SPEC.hunterCreditsSpent,
      hunterBackOnlineSweepV1: true,
      [FIGMA_CONFIG_SEEDED_FLAG]: true,
      figmaConfig2027SeededAt: nowIso,
    },
    FIGMA_CONFIG_2027_SPEC.salesInitiative
  );
}

export function buildFigmaConfigOpportunityMetadata(
  existing: Record<string, unknown> | null | undefined,
  nowIso: string = new Date().toISOString()
): Record<string, unknown> {
  const opp = FIGMA_CONFIG_2027_SPEC.opportunity;
  return {
    ...(existing ?? {}),
    enqueuedManually: true,
    eventWebsiteUrl: FIGMA_CONFIG_2027_SPEC.eventWebsiteUrl,
    salesInitiative: FIGMA_CONFIG_2027_SPEC.salesInitiative,
    revenueEngine: opp.revenueEngine,
    flagshipOffer: opp.flagshipOffer,
    businessCategory: opp.businessCategory,
    productExperience: opp.productExperience,
    dealType: opp.dealType,
    suggestedAnthemFee: opp.suggestedAnthemFee,
    potentialAmount: opp.suggestedAnthemFee,
    pricingCategory: opp.pricingCategory,
    pricingTier: opp.pricingTier,
    pricingConfidence: "high",
    pricingRationale:
      "Flagship global tech & product-design conference (8,000+ in-person attendees at Pier 80, San Francisco; $600 early-bird / $1,200 standard passes).",
    pricingEvaluatedAt: nowIso,
    pricingFrameworkVersion: PRICING_FRAMEWORK_VERSION,
    [FIGMA_CONFIG_SEEDED_FLAG]: true,
    figmaConfig2027SeededAt: nowIso,
  };
}

async function findFigmaOrganization(): Promise<Organization | null> {
  const byPrimary = await findExistingOrganization(
    FIGMA_CONFIG_2027_SPEC.organizationName,
    FIGMA_CONFIG_2027_SPEC.websiteUrl
  );
  if (byPrimary) return byPrimary;
  for (const alt of FIGMA_CONFIG_2027_SPEC.alternateNames) {
    const found = await findExistingOrganization(alt, null);
    if (found) return found;
  }
  return null;
}

export type SeedFigmaConfig2027Result = {
  name: string;
  createdOrg: boolean;
  alreadySeeded: boolean;
  contactsCreated: number;
  contactsUpdated: number;
  enqueued: boolean;
  organizationId: string | null;
  opportunityId: string | null;
  queueItemId: string | null;
  error: string | null;
};

export async function seedFigmaConfig2027(options?: {
  force?: boolean;
}): Promise<SeedFigmaConfig2027Result> {
  const force = Boolean(options?.force);
  const nowIso = new Date().toISOString();

  try {
    const existingOrg = await findFigmaOrganization();
    const priorMeta = (existingOrg?.importMetadata ?? {}) as Record<string, unknown>;
    if (existingOrg && priorMeta[FIGMA_CONFIG_SEEDED_FLAG] === true && !force) {
      const opps = await listOpportunitiesForOrganization(existingOrg.id);
      const opp =
        opps.find(
          (o) =>
            o.title.toLowerCase() === FIGMA_CONFIG_2027_SPEC.opportunity.title.toLowerCase() ||
            (o.importMetadata as Record<string, unknown> | null)?.[FIGMA_CONFIG_SEEDED_FLAG] === true
        ) ?? opps[0] ?? null;
      return {
        name: existingOrg.name,
        createdOrg: false,
        alreadySeeded: true,
        contactsCreated: 0,
        contactsUpdated: 0,
        enqueued: false,
        organizationId: existingOrg.id,
        opportunityId: opp?.id ?? null,
        queueItemId: null,
        error: null,
      };
    }

    const orgType = await findOrganizationTypeByKey(FIGMA_CONFIG_2027_SPEC.organizationTypeKey);
    const orgMeta = buildFigmaConfigOrgMetadata(existingOrg?.importMetadata ?? null, nowIso);

    let organization: Organization;
    let createdOrg = false;
    if (!existingOrg) {
      organization = await createOrganization({
        name: FIGMA_CONFIG_2027_SPEC.organizationName,
        websiteUrl: FIGMA_CONFIG_2027_SPEC.websiteUrl,
        locationCity: FIGMA_CONFIG_2027_SPEC.locationCity,
        locationRegion: FIGMA_CONFIG_2027_SPEC.locationRegion,
        locationCountry: FIGMA_CONFIG_2027_SPEC.locationCountry,
        organizationTypeId: orgType?.id ?? null,
        source: "manual",
        isExistingClient: false,
        importMetadata: orgMeta,
      });
      createdOrg = true;
    } else {
      organization = await updateOrganization(existingOrg.id, {
        websiteUrl: existingOrg.websiteUrl ?? FIGMA_CONFIG_2027_SPEC.websiteUrl,
        locationCity: existingOrg.locationCity ?? FIGMA_CONFIG_2027_SPEC.locationCity,
        locationRegion: existingOrg.locationRegion ?? FIGMA_CONFIG_2027_SPEC.locationRegion,
        locationCountry: existingOrg.locationCountry ?? FIGMA_CONFIG_2027_SPEC.locationCountry,
        organizationTypeId: existingOrg.organizationTypeId ?? orgType?.id ?? null,
        importMetadata: orgMeta,
      });
    }

    let contactsCreated = 0;
    let contactsUpdated = 0;
    let primaryContactId: string | null = null;

    for (const spec of FIGMA_CONFIG_2027_SPEC.contacts) {
      const contactMeta = {
        hunterDomainSearch: true,
        hunterConfidence: spec.hunterConfidence,
        hunterVerifier: spec.hunterVerifier,
        roleDescription: spec.roleDescription,
      };
      const existingContact = await findExistingContact(
        organization.id,
        spec.email,
        spec.fullName
      );
      let saved: Contact;
      if (existingContact) {
        saved = await updateContact(existingContact.id, {
          fullName: spec.fullName,
          roleTitle: spec.roleTitle,
          roleCategory: spec.roleCategory,
          email: spec.email,
          linkedinUrl: spec.linkedinUrl,
          emailVerificationStatus: spec.emailVerificationStatus,
          importMetadata: {
            ...((existingContact.importMetadata as Record<string, unknown> | null) ?? {}),
            ...contactMeta,
          },
        });
        contactsUpdated += 1;
      } else {
        saved = await createContact({
          organizationId: organization.id,
          fullName: spec.fullName,
          roleTitle: spec.roleTitle,
          roleCategory: spec.roleCategory,
          email: spec.email,
          linkedinUrl: spec.linkedinUrl,
          source: "ai_discovered",
          emailVerificationStatus: spec.emailVerificationStatus,
          importMetadata: contactMeta,
        });
        contactsCreated += 1;
      }
      if (spec.primary) primaryContactId = saved.id;
    }

    const oppSpec = FIGMA_CONFIG_2027_SPEC.opportunity;
    const manual = await enqueueOrgManually({
      organization,
      title: oppSpec.title,
      description: oppSpec.description,
      eventOrInitiativeName: oppSpec.eventOrInitiativeName,
      eventDateEstimate: oppSpec.eventDateEstimate,
      eventDateConfidence: oppSpec.eventDateConfidence,
      opportunityTypeKey: oppSpec.opportunityTypeKey,
      totalScoreHint: oppSpec.totalScoreHint,
    });

    // Preserve operatorQueuedAt + seed markers on the org.
    const reloadedOrg = await getOrganization(organization.id);
    if (reloadedOrg) {
      await updateOrganization(organization.id, {
        importMetadata: buildFigmaConfigOrgMetadata(reloadedOrg.importMetadata, nowIso),
      });
    }

    const opp = await getOpportunity(manual.opportunityId);
    await updateOpportunityImportMetadata(
      manual.opportunityId,
      buildFigmaConfigOpportunityMetadata(opp?.importMetadata ?? null, nowIso)
    );

    // Tailor Config 2027 Pier 80 drafts for all contacts and point queue item at Azra Daniels (Director, Experiential Marketing).
    const allContacts = await listContactsForOrganization(organization.id);
    const contactById = new Map(allContacts.map((c) => [c.id, c]));
    const drafts = await listDraftsForOpportunity(manual.opportunityId);
    let primaryDraftId: string | null = null;

    for (const draft of drafts) {
      if (draft.kind !== "initial" || !draft.contactId) continue;
      const c = contactById.get(draft.contactId);
      if (!c?.fullName) continue;
      if (
        (draft.status === "draft" || draft.status === "qa_flagged") &&
        draft.editedSubject == null &&
        draft.editedBody == null
      ) {
        const copy = buildFigmaConfigDraft(c.fullName);
        await updateDraftAiCopy(draft.id, {
          aiSubject: copy.subject,
          aiBody: copy.body,
        });
      }
      if (draft.contactId === primaryContactId) {
        primaryDraftId = draft.id;
      }
    }

    if (primaryDraftId && primaryDraftId !== manual.outreachDraftId) {
      await createOrUpdateQueueItem({
        opportunityId: manual.opportunityId,
        outreachDraftId: primaryDraftId,
        prospectScoreId: manual.prospectScoreId,
        touchCreatedAt: true,
      });
    }

    await refreshAutoSendPlan().catch(() => null);

    return {
      name: organization.name,
      createdOrg,
      alreadySeeded: false,
      contactsCreated,
      contactsUpdated,
      enqueued: true,
      organizationId: organization.id,
      opportunityId: manual.opportunityId,
      queueItemId: manual.queueItemId,
      error: null,
    };
  } catch (err) {
    return {
      name: FIGMA_CONFIG_2027_SPEC.organizationName,
      createdOrg: false,
      alreadySeeded: false,
      contactsCreated: 0,
      contactsUpdated: 0,
      enqueued: false,
      organizationId: null,
      opportunityId: null,
      queueItemId: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Public read-only status check — lists contact names + verification statuses without exposing email addresses. */
export async function getFigmaConfig2027Status(): Promise<{
  name: string;
  present: boolean;
  markedSeeded: boolean;
  queued: boolean;
  eventDate: string | null;
  suggestedAnthemFee: number | null;
  contactCount: number;
  done: boolean;
  contacts: Array<{
    fullName: string | null;
    roleTitle: string | null;
    source: string;
    emailVerificationStatus: string | null;
  }>;
}> {
  const existing = await findFigmaOrganization();
  if (!existing) {
    return {
      name: FIGMA_CONFIG_2027_SPEC.organizationName,
      present: false,
      markedSeeded: false,
      queued: false,
      eventDate: null,
      suggestedAnthemFee: null,
      contactCount: 0,
      done: false,
      contacts: [],
    };
  }

  const meta = (existing.importMetadata ?? {}) as Record<string, unknown>;
  const markedSeeded = meta[FIGMA_CONFIG_SEEDED_FLAG] === true;
  const contacts = (await listContactsForOrganization(existing.id)).filter(
    (c) => !c.duplicateOfContactId
  );
  const opps = await listOpportunitiesForOrganization(existing.id);
  const targetOpp =
    opps.find(
      (o) =>
        o.title.toLowerCase() === FIGMA_CONFIG_2027_SPEC.opportunity.title.toLowerCase() ||
        (o.importMetadata as Record<string, unknown> | null)?.[FIGMA_CONFIG_SEEDED_FLAG] === true
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

  const oppMeta = (targetOpp?.importMetadata ?? {}) as Record<string, unknown>;
  const suggestedAnthemFee =
    typeof oppMeta.suggestedAnthemFee === "number" ? oppMeta.suggestedAnthemFee : null;

  return {
    name: existing.name,
    present: true,
    markedSeeded,
    queued,
    eventDate: targetOpp?.eventDateEstimate ?? null,
    suggestedAnthemFee,
    contactCount: contacts.length,
    done: markedSeeded && queued && contacts.length >= 3,
    contacts: contacts.map((c) => ({
      fullName: c.fullName,
      roleTitle: c.roleTitle,
      source: c.source,
      emailVerificationStatus: c.emailVerificationStatus,
    })),
  };
}
