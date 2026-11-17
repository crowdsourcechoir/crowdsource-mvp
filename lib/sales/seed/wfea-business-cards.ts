import type {
  BusinessCategoryKey,
  DealTypeKey,
  ProductExperienceKey,
} from "@/lib/sales/business-model";
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
import { createOrUpdateQueueItem } from "@/lib/sales/db/queue";
import { normalizeEmail } from "@/lib/sales/dedupe";
import type { RevenueEngineKey } from "@/lib/sales/engines";
import { followUpPresetIso } from "@/lib/sales/follow-up/calendar";
import { withSalesInitiative, type SalesInitiativeKey } from "@/lib/sales/initiatives";
import { enqueueOrgManually } from "@/lib/sales/seed/enqueue-manual";
import type { Contact, Organization } from "@/lib/sales/types";

export const WFEA_BUSINESS_CARDS_SEEDED_FLAG = "wfeaBusinessCardSeeded";

export type WfeaBusinessCardSpec = {
  key: "kylie_martinez" | "deci_evans" | "gazala_uradnik";
  organizationName: string;
  alternateNames: readonly string[];
  websiteUrl: string;
  alternateWebsites: readonly string[];
  locationCity: string;
  locationRegion: string;
  locationCountry: string;
  organizationTypeKey: string;
  salesInitiative: SalesInitiativeKey;
  eventName: string;
  searchTags: readonly string[];
  operatorCardSummary: string;
  contact: {
    fullName: string;
    pronouns: string | null;
    roleTitle: string;
    roleCategory: string;
    email: string;
    phone: string;
    officePhone: string | null;
    cellPhone: string | null;
    mailingAddress: string | null;
    instagramHandle: string | null;
    roleDescription: string;
  };
  opportunity: {
    title: string;
    eventOrInitiativeName: string;
    opportunityTypeKey: string;
    description: string;
    businessCategory: BusinessCategoryKey;
    productExperience: ProductExperienceKey;
    dealType: DealTypeKey;
    editionBloom: string;
    revenueEngine: RevenueEngineKey;
    totalScoreHint: number;
  };
  draft: {
    subject: string;
    body: string;
  };
};

/**
 * Three in-person business cards to add into Interest + queue:
 * 1. Kylie Martinez — Friends of Waterfront Park
 * 2. Deci Evans — Kind + Co Events
 * 3. Gazala Uradnik — GFS Events
 *
 * Cari Dixon (Washington State Fair Event Center, carid@thefair.com) is already in
 * the system and intentionally excluded so her existing record/state is untouched.
 */
export const WFEA_BUSINESS_CARDS: readonly WfeaBusinessCardSpec[] = [
  {
    key: "kylie_martinez",
    organizationName: "Friends of Waterfront Park",
    alternateNames: [
      "Friends of Waterfront Seattle",
      "Waterfront Park Seattle",
      "Waterfront Park",
    ],
    websiteUrl: "https://waterfrontparkseattle.org",
    alternateWebsites: [],
    locationCity: "Seattle",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "venue",
    salesInitiative: "wfea_network",
    eventName: "WFEA",
    searchTags: ["wfea", "waterfront_park", "seattle", "venue", "partnership", "other"],
    operatorCardSummary:
      "Met Kylie Martinez (Events Sales Manager, She/Her) — business card capture. Manages event sales, partner activations, and venue bookings across Seattle's 20-acre Waterfront Park (Pier 62, Pier 58, Overlook Walk, Park Promenade).\n\nCard details: kylie@waterfrontparkseattle.org | Office: (206) 445-7636 | Cell: (801) 664-8777 | 1201 Alaskan Way, Ste. 200, Seattle, WA 98101 | waterfrontparkseattle.org",
    contact: {
      fullName: "Kylie Martinez",
      pronouns: "She/Her",
      roleTitle: "Events Sales Manager",
      roleCategory: "events",
      email: "kylie@waterfrontparkseattle.org",
      phone: "(206) 445-7636 (office) | (801) 664-8777 (cell)",
      officePhone: "(206) 445-7636",
      cellPhone: "(801) 664-8777",
      mailingAddress: "1201 Alaskan Way, Ste. 200, Seattle, WA 98101",
      instagramHandle: null,
      roleDescription:
        "Events Sales Manager at Friends of Waterfront Park (She/Her) — met in person (business card capture). Manages event sales, partner activations, and venue bookings across Seattle's 20-acre Waterfront Park (Pier 62, Pier 58, Overlook Walk, and Park Promenade); strong venue and public-programming doorway for commissioned Waterfront activations, Pier Party or Waterfront Block Party moments, or a funded Seattle Rave Choir waterfront edition.",
    },
    opportunity: {
      title: "Friends of Waterfront Park — Waterfront venue & activation partnership",
      eventOrInitiativeName: "Waterfront Park Seattle",
      opportunityTypeKey: "community_festival",
      description:
        "Met Kylie Martinez (Events Sales Manager) — business card capture. Explore commissioned participatory activations, Song Gardens, or Anthems for Waterfront Park Seattle gatherings (Waterfront Block Party, Pier Party, seasonal shoreline activations) and Pier 62 venue partnership opportunities.",
      businessCategory: "commissioned",
      productExperience: "custom_activation",
      dealType: "venue_partnership",
      editionBloom: "Waterfront Park Seattle",
      revenueEngine: "premium",
      totalScoreHint: 86,
    },
    draft: {
      subject: "Great meeting you — Crowdsource Choir + Waterfront Park",
      body: [
        "Hi Kylie,",
        "",
        "It was great meeting you and connecting! I love what Friends of Waterfront Park has built across the shoreline and Pier 62 for Seattle.",
        "",
        "As a quick reminder, I'm Joel DeJong, founder of Crowdsource Choir here in Seattle — a participatory entertainment company where audiences and crowds become the choir. Through digital Song Gardens and live participatory gatherings, community voices and stories come together into original Anthems and high-energy shared moments.",
        "",
        "I'd love to explore what a collaboration at Waterfront Park could look like — whether a commissioned community Song Garden or participatory Anthem for a signature gathering like Waterfront Block Party or Pier Party, or partnering on Pier 62 for a sponsored public show.",
        "",
        "Here's a short look at what we create:",
        "https://www.crowdsourcechoir.com/book",
        "",
        "Would you be open to grabbing a quick coffee or jumping on a short call in the next couple of weeks to trade ideas?",
        "",
        "Thanks, Kylie — great meeting you!",
        "",
        "Best,",
        "Joel",
      ].join("\n"),
    },
  },
  {
    key: "deci_evans",
    organizationName: "Kind + Co Events",
    alternateNames: [
      "Kind and Company Events",
      "Kind & Co Events",
      "Kind Co Events",
      "KAC Events",
    ],
    websiteUrl: "https://www.kacevents.com",
    alternateWebsites: [
      "https://kindandcompanyevents.org",
      "https://www.kindandcompanyevents.org",
    ],
    locationCity: "Seattle",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "event_agency",
    salesInitiative: "fundraising_galas",
    eventName: "WFEA",
    searchTags: [
      "wfea",
      "kind_and_co",
      "kacevents",
      "gala_producer",
      "conferences",
      "fundraisers",
      "event_agency",
    ],
    operatorCardSummary:
      "Met Deci Evans (Owner/CEO, Kind + Co Events) — business card capture. Seattle-based nonprofit fundraising event and conference management company leading galas, annual meetings, and conferences across the Pacific Northwest, Arizona, Hawaiʻi, and Canada.\n\nCard details: info@kindandcompanyevents.org | 206-605-1873 | www.kacevents.com | IG @kindandcoevents",
    contact: {
      fullName: "Deci Evans",
      pronouns: null,
      roleTitle: "Owner/CEO",
      roleCategory: "executive",
      email: "info@kindandcompanyevents.org",
      phone: "206-605-1873",
      officePhone: null,
      cellPhone: null,
      mailingAddress: null,
      instagramHandle: "@kindandcoevents",
      roleDescription:
        "Owner/CEO of Kind + Co Events — met in person (business card capture). Seattle-based nonprofit fundraising event and conference management firm serving clients across Seattle, Bellevue, Tacoma, Arizona, Hawaiʻi, and Canada; strong production partner for bringing commissioned participatory Anthems into flagship galas and annual conferences. Card lists info@kindandcompanyevents.org (site also lists info@kacevents.com; IG @kindandcoevents).",
    },
    opportunity: {
      title: "Kind + Co Events — Gala & conference production partnership",
      eventOrInitiativeName: "Nonprofit galas & conferences",
      opportunityTypeKey: "fundraising_gala",
      description:
        "Met Deci Evans (Owner/CEO, Kind + Co Events) — business card capture. Explore a production partnership bringing commissioned participatory Anthems and shared-creation moments to Kind + Co's nonprofit fundraising galas and conferences across the Pacific Northwest and beyond.",
      businessCategory: "commissioned",
      productExperience: "anthem",
      dealType: "production_partnership",
      editionBloom: "Nonprofit Galas & Conferences",
      revenueEngine: "premium",
      totalScoreHint: 87,
    },
    draft: {
      subject: "Great meeting you — Crowdsource Choir + Kind + Co Events",
      body: [
        "Hi Deci,",
        "",
        "It was great meeting you and connecting! I really admire Kind + Co's focus on mission-centered fundraising events and conferences that actually build community in the room.",
        "",
        "As a quick reminder, I'm Joel DeJong, founder of Crowdsource Choir here in Seattle — a participatory entertainment company where audiences become the choir. For fundraising galas and conferences, attendees contribute their voices and stories, and we weave them into an original Anthem that the whole room performs together right before a paddle raise, opening, or closing moment.",
        "",
        "I'd love to explore how we might partner on future client galas or conferences where you want an unforgettable moment of collective energy in the room.",
        "",
        "Here's a short look at the experience:",
        "https://www.crowdsourcechoir.com/book",
        "",
        "Would you be open to a quick call or coffee in the next couple of weeks to get acquainted and trade ideas?",
        "",
        "Thanks, Deci — great meeting you!",
        "",
        "Best,",
        "Joel",
      ].join("\n"),
    },
  },
  {
    key: "gazala_uradnik",
    organizationName: "GFS Events",
    alternateNames: [
      "gfs events",
      "Growth & Fundraising Solutions",
      "GFS Events LLC",
    ],
    websiteUrl: "https://www.gfsevents.org",
    alternateWebsites: [],
    locationCity: "Seattle",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "event_agency",
    salesInitiative: "fundraising_galas",
    eventName: "WFEA",
    searchTags: [
      "wfea",
      "gfs_events",
      "gala_producer",
      "fundraisers",
      "mini_con",
      "event_agency",
    ],
    operatorCardSummary:
      "Met Gazala Uradnik (Founder, GFS Events — growth & fundraising solutions for nonprofits) — business card capture. Full-service Seattle-area nonprofit fundraising event management company producing major galas across Puget Sound (Wing Luke Museum, Medic One Foundation, REST Seattle, Seattle Animal Shelter, Washington State Nonprofit Conference) and hosting Mini-Con 2027 in Seattle.\n\nCard details: gazala@gfsevents.org | 425-985-0208 | www.gfsevents.org",
    contact: {
      fullName: "Gazala Uradnik",
      pronouns: null,
      roleTitle: "Founder",
      roleCategory: "executive",
      email: "gazala@gfsevents.org",
      phone: "425-985-0208",
      officePhone: null,
      cellPhone: null,
      mailingAddress: null,
      instagramHandle: null,
      roleDescription:
        "Founder of GFS Events (growth & fundraising solutions for nonprofits) — met in person (business card capture). Full-service Seattle-area nonprofit fundraising event producer behind major Pacific Northwest galas (Wing Luke Museum, Medic One Foundation, REST Seattle, Seattle Animal Shelter, Washington State Nonprofit Conference) and host of Mini-Con 2027 (Jan 27, 2027 in Seattle); high-leverage production partner for commissioned gala Anthems.",
    },
    opportunity: {
      title: "GFS Events — Nonprofit gala production partnership & Mini-Con",
      eventOrInitiativeName: "Nonprofit fundraising galas & Mini-Con 2027",
      opportunityTypeKey: "fundraising_gala",
      description:
        "Met Gazala Uradnik (Founder, GFS Events — growth & fundraising solutions for nonprofits) — business card capture. Explore a production partnership placing commissioned participatory Anthems into GFS-produced nonprofit fundraising galas across Puget Sound, plus connecting around Mini-Con 2027 in Seattle.",
      businessCategory: "commissioned",
      productExperience: "anthem",
      dealType: "production_partnership",
      editionBloom: "Nonprofit Fundraising Galas",
      revenueEngine: "premium",
      totalScoreHint: 88,
    },
    draft: {
      subject: "Great meeting you — Crowdsource Choir + GFS Events",
      body: [
        "Hi Gazala,",
        "",
        "It was great meeting you and connecting! I love how GFS Events approaches nonprofit galas and fundraisers through the lens of genuine donor connection and mission impact.",
        "",
        "As a quick reminder, I'm Joel DeJong, founder of Crowdsource Choir here in Seattle — a participatory entertainment company where the audience becomes the choir. Supporters contribute their voices and stories, and we bring them together into an original Anthem for the organization that the entire ballroom performs live together.",
        "",
        "Because GFS produces so many standout fundraising galas across the region (and gathers nonprofit leaders at Mini-Con), I'd love to explore how we could be a creative partner in your toolkit when a client wants an unforgettable mission moment in the room.",
        "",
        "Here's a short look at what we create:",
        "https://www.crowdsourcechoir.com/book",
        "",
        "Would you be open to a quick call or coffee in the next couple of weeks to trade ideas?",
        "",
        "Thanks, Gazala — great meeting you!",
        "",
        "Best,",
        "Joel",
      ].join("\n"),
    },
  },
] as const;

export function buildCardOrganizationMetadata(
  spec: WfeaBusinessCardSpec,
  existing: Record<string, unknown> | null | undefined,
  nowIso: string = new Date().toISOString()
): Record<string, unknown> {
  const priorNotes =
    typeof existing?.operatorNotes === "string" ? existing.operatorNotes.trim() : "";
  const operatorNotes =
    priorNotes && !priorNotes.includes(spec.contact.fullName)
      ? `${spec.operatorCardSummary}\n\n---\n${priorNotes}`.slice(0, 4000)
      : priorNotes || spec.operatorCardSummary;

  const priorTags = Array.isArray(existing?.searchTags)
    ? (existing.searchTags as unknown[]).filter((t): t is string => typeof t === "string")
    : [];
  const mergedTags = Array.from(new Set([...priorTags, ...spec.searchTags]));

  return withSalesInitiative(
    {
      ...(existing ?? {}),
      operatorNotes,
      wfeaNetwork: true,
      addedFromCardScan: true,
      source: "business_card_scan",
      eventName: spec.eventName,
      revenueEngine: spec.opportunity.revenueEngine,
      businessCategory: spec.opportunity.businessCategory,
      productExperience: spec.opportunity.productExperience,
      dealType: spec.opportunity.dealType,
      ...(spec.contact.instagramHandle ? { instagramHandle: spec.contact.instagramHandle } : {}),
      ...(spec.alternateWebsites.length > 0
        ? { alternateWebsites: [...spec.alternateWebsites] }
        : {}),
      searchTags: mergedTags,
      [WFEA_BUSINESS_CARDS_SEEDED_FLAG]: true,
      wfeaBusinessCardKey: spec.key,
      wfeaBusinessCardSeededAt: nowIso,
    },
    spec.salesInitiative
  );
}

export function buildCardOpportunityMetadata(
  spec: WfeaBusinessCardSpec,
  existing: Record<string, unknown> | null | undefined,
  nowIso: string = new Date().toISOString()
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    enqueuedManually: true,
    source: "business_card_scan",
    eventName: spec.eventName,
    salesInitiative: spec.salesInitiative,
    revenueEngine: spec.opportunity.revenueEngine,
    businessCategory: spec.opportunity.businessCategory,
    productExperience: spec.opportunity.productExperience,
    dealType: spec.opportunity.dealType,
    editionBloom: spec.opportunity.editionBloom,
    [WFEA_BUSINESS_CARDS_SEEDED_FLAG]: true,
    wfeaBusinessCardKey: spec.key,
    wfeaBusinessCardSeededAt: nowIso,
  };
}

async function findCardOrganization(spec: WfeaBusinessCardSpec): Promise<Organization | null> {
  const byPrimary = await findExistingOrganization(spec.organizationName, spec.websiteUrl);
  if (byPrimary) return byPrimary;
  for (const altSite of spec.alternateWebsites) {
    const byAltSite = await findExistingOrganization(spec.organizationName, altSite);
    if (byAltSite) return byAltSite;
  }
  for (const altName of spec.alternateNames) {
    const byAltName = await findExistingOrganization(altName, null);
    if (byAltName) return byAltName;
  }
  return null;
}

export type SeededBusinessCardEntry = {
  key: WfeaBusinessCardSpec["key"];
  organizationName: string;
  contactName: string;
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

export type SeedWfeaBusinessCardsResult = {
  attempted: number;
  createdOrgs: number;
  updatedOrgs: number;
  contactsCreated: number;
  contactsUpdated: number;
  enqueued: number;
  skippedAlreadySeeded: number;
  errors: Array<{ key: string; organizationName: string; error: string }>;
  cards: SeededBusinessCardEntry[];
};

async function seedSingleBusinessCard(
  spec: WfeaBusinessCardSpec,
  options?: { force?: boolean }
): Promise<SeededBusinessCardEntry> {
  const force = Boolean(options?.force);
  const nowIso = new Date().toISOString();
  const normalizedTargetEmail = normalizeEmail(spec.contact.email);

  try {
    const existingOrg = await findCardOrganization(spec);
    if (!force && existingOrg) {
      const meta = (existingOrg.importMetadata ?? {}) as Record<string, unknown>;
      if (meta[WFEA_BUSINESS_CARDS_SEEDED_FLAG] === true) {
        const contacts = await listContactsForOrganization(existingOrg.id);
        const matchingContact = contacts.find(
          (c) =>
            !c.duplicateOfContactId &&
            normalizeEmail(c.email) === normalizedTargetEmail
        );
        const opps = await listOpportunitiesForOrganization(existingOrg.id);
        const opp =
          opps.find(
            (o) =>
              o.title.toLowerCase() === spec.opportunity.title.toLowerCase() ||
              (o.importMetadata as Record<string, unknown> | null)?.[
                WFEA_BUSINESS_CARDS_SEEDED_FLAG
              ] === true
          ) ??
          opps[0] ??
          null;

        if (matchingContact && opp) {
          return {
            key: spec.key,
            organizationName: existingOrg.name,
            contactName: matchingContact.fullName ?? spec.contact.fullName,
            createdOrg: false,
            updatedOrg: false,
            contactCreated: false,
            contactUpdated: false,
            enqueued: false,
            skippedAlreadySeeded: true,
            organizationId: existingOrg.id,
            contactId: matchingContact.id,
            opportunityId: opp.id,
            queueItemId: null,
            relationshipStage: (opp.relationshipStage as "interest" | null) ?? null,
            nextFollowUpAt: opp.nextFollowUpAt ?? null,
            error: null,
          };
        }
      }
    }

    const orgType = await findOrganizationTypeByKey(spec.organizationTypeKey);
    const orgMeta = buildCardOrganizationMetadata(spec, existingOrg?.importMetadata ?? null, nowIso);

    let createdOrg = false;
    let updatedOrg = false;
    let organization: Organization;

    if (!existingOrg) {
      organization = await createOrganization({
        name: spec.organizationName,
        websiteUrl: spec.websiteUrl,
        locationCity: spec.locationCity,
        locationRegion: spec.locationRegion,
        locationCountry: spec.locationCountry,
        organizationTypeId: orgType?.id ?? null,
        source: "manual",
        isExistingClient: false,
        importMetadata: orgMeta,
      });
      createdOrg = true;
    } else {
      organization = await updateOrganization(existingOrg.id, {
        websiteUrl: existingOrg.websiteUrl ?? spec.websiteUrl,
        locationCity: existingOrg.locationCity ?? spec.locationCity,
        locationRegion: existingOrg.locationRegion ?? spec.locationRegion,
        locationCountry: existingOrg.locationCountry ?? spec.locationCountry,
        organizationTypeId: existingOrg.organizationTypeId ?? orgType?.id ?? null,
        importMetadata: orgMeta,
      });
      updatedOrg = true;
    }

    const c = spec.contact;
    const contactMeta: Record<string, unknown> = {
      seededManually: true,
      source: "business_card_scan",
      eventName: spec.eventName,
      roleDescription: c.roleDescription,
      ...(c.pronouns ? { pronouns: c.pronouns } : {}),
      ...(c.officePhone ? { officePhone: c.officePhone } : {}),
      ...(c.cellPhone ? { cellPhone: c.cellPhone } : {}),
      ...(c.mailingAddress ? { mailingAddress: c.mailingAddress } : {}),
      ...(c.instagramHandle ? { instagramHandle: c.instagramHandle } : {}),
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
      title: spec.opportunity.title,
      description: spec.opportunity.description,
      eventOrInitiativeName: spec.opportunity.eventOrInitiativeName,
      opportunityTypeKey: spec.opportunity.opportunityTypeKey,
      totalScoreHint: spec.opportunity.totalScoreHint,
    });

    // Preserve operatorQueuedAt stamped by enqueueOrgManually alongside our card seed metadata.
    const reloadedOrg = await getOrganization(organization.id);
    if (reloadedOrg) {
      await updateOrganization(organization.id, {
        importMetadata: buildCardOrganizationMetadata(spec, reloadedOrg.importMetadata, nowIso),
      });
    }

    const opp = await getOpportunity(manual.opportunityId);
    await updateOpportunityImportMetadata(
      manual.opportunityId,
      buildCardOpportunityMetadata(spec, opp?.importMetadata ?? null, nowIso)
    );
    await updateOpportunityRelationshipStage(manual.opportunityId, "interest");

    const nextFollowUpAt = opp?.nextFollowUpAt ?? followUpPresetIso("today");
    if (!opp?.nextFollowUpAt) {
      await updateOpportunityTouchTimestamps(manual.opportunityId, { nextFollowUpAt });
    }

    // Apply warm in-person draft copy for this card contact without overwriting human edits,
    // and ensure the queue item points at this card contact's draft when an org had prior contacts.
    const drafts = await listDraftsForOpportunity(manual.opportunityId);
    let cardContactDraftId: string | null = null;
    for (const draft of drafts) {
      if (draft.kind === "initial" && draft.contactId === contact.id) {
        cardContactDraftId = draft.id;
        if (
          (draft.status === "draft" || draft.status === "qa_flagged") &&
          draft.editedSubject == null &&
          draft.editedBody == null
        ) {
          await updateDraftAiCopy(draft.id, {
            aiSubject: spec.draft.subject,
            aiBody: spec.draft.body,
          });
        }
      }
    }

    let queueItemId = manual.queueItemId;
    if (cardContactDraftId && manual.outreachDraftId !== cardContactDraftId) {
      const updatedQueueItem = await createOrUpdateQueueItem({
        opportunityId: manual.opportunityId,
        outreachDraftId: cardContactDraftId,
        prospectScoreId: manual.prospectScoreId,
        duplicateWarning: false,
        touchCreatedAt: true,
      });
      queueItemId = updatedQueueItem.id;
    }

    return {
      key: spec.key,
      organizationName: organization.name,
      contactName: contact.fullName ?? c.fullName,
      createdOrg,
      updatedOrg,
      contactCreated,
      contactUpdated,
      enqueued: true,
      skippedAlreadySeeded: false,
      organizationId: organization.id,
      contactId: contact.id,
      opportunityId: manual.opportunityId,
      queueItemId,
      relationshipStage: "interest",
      nextFollowUpAt,
      error: null,
    };
  } catch (err) {
    return {
      key: spec.key,
      organizationName: spec.organizationName,
      contactName: spec.contact.fullName,
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

export async function seedWfeaBusinessCards(options?: {
  force?: boolean;
}): Promise<SeedWfeaBusinessCardsResult> {
  const result: SeedWfeaBusinessCardsResult = {
    attempted: WFEA_BUSINESS_CARDS.length,
    createdOrgs: 0,
    updatedOrgs: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    enqueued: 0,
    skippedAlreadySeeded: 0,
    errors: [],
    cards: [],
  };

  for (const spec of WFEA_BUSINESS_CARDS) {
    const entry = await seedSingleBusinessCard(spec, options);
    result.cards.push(entry);
    if (entry.createdOrg) result.createdOrgs += 1;
    if (entry.updatedOrg) result.updatedOrgs += 1;
    if (entry.contactCreated) result.contactsCreated += 1;
    if (entry.contactUpdated) result.contactsUpdated += 1;
    if (entry.enqueued) result.enqueued += 1;
    if (entry.skippedAlreadySeeded) result.skippedAlreadySeeded += 1;
    if (entry.error) {
      result.errors.push({
        key: spec.key,
        organizationName: spec.organizationName,
        error: entry.error,
      });
    }
  }

  return result;
}

/** Public read-only status check (no email addresses exposed). */
export async function getWfeaBusinessCardsSeedStatus(): Promise<{
  expected: number;
  present: number;
  markedSeeded: number;
  queued: number;
  done: boolean;
  cards: Array<{
    key: WfeaBusinessCardSpec["key"];
    organizationName: string;
    contactName: string;
    present: boolean;
    markedSeeded: boolean;
    contactPresent: boolean;
    contactCount: number;
    queued: boolean;
    relationshipStage: string | null;
  }>;
}> {
  const cards: Array<{
    key: WfeaBusinessCardSpec["key"];
    organizationName: string;
    contactName: string;
    present: boolean;
    markedSeeded: boolean;
    contactPresent: boolean;
    contactCount: number;
    queued: boolean;
    relationshipStage: string | null;
  }> = [];

  const db = requireSupabaseAdmin();

  for (const spec of WFEA_BUSINESS_CARDS) {
    const existing = await findCardOrganization(spec);
    if (!existing) {
      cards.push({
        key: spec.key,
        organizationName: spec.organizationName,
        contactName: spec.contact.fullName,
        present: false,
        markedSeeded: false,
        contactPresent: false,
        contactCount: 0,
        queued: false,
        relationshipStage: null,
      });
      continue;
    }

    const meta = (existing.importMetadata ?? {}) as Record<string, unknown>;
    const markedSeeded = meta[WFEA_BUSINESS_CARDS_SEEDED_FLAG] === true;
    const contacts = await listContactsForOrganization(existing.id);
    const activeContacts = contacts.filter((c) => !c.duplicateOfContactId);
    const targetEmail = normalizeEmail(spec.contact.email);
    const contactPresent = activeContacts.some(
      (c) =>
        normalizeEmail(c.email) === targetEmail ||
        (c.fullName ?? "").trim().toLowerCase() === spec.contact.fullName.toLowerCase()
    );

    const opps = await listOpportunitiesForOrganization(existing.id);
    const targetOpp =
      opps.find(
        (o) =>
          o.title.toLowerCase() === spec.opportunity.title.toLowerCase() ||
          (o.importMetadata as Record<string, unknown> | null)?.[
            WFEA_BUSINESS_CARDS_SEEDED_FLAG
          ] === true
      ) ??
      opps[0] ??
      null;

    let queued = false;
    if (targetOpp) {
      const { count } = await db
        .from("approval_queue_items")
        .select("id", { count: "exact", head: true })
        .eq("opportunity_id", targetOpp.id);
      queued = (count ?? 0) > 0;
    }

    cards.push({
      key: spec.key,
      organizationName: existing.name,
      contactName: spec.contact.fullName,
      present: true,
      markedSeeded,
      contactPresent,
      contactCount: activeContacts.length,
      queued,
      relationshipStage: targetOpp?.relationshipStage ?? null,
    });
  }

  const present = cards.filter((c) => c.present).length;
  const markedSeeded = cards.filter((c) => c.markedSeeded).length;
  const queued = cards.filter((c) => c.queued).length;
  const allContactsPresent = cards.every((c) => c.contactPresent);

  return {
    expected: WFEA_BUSINESS_CARDS.length,
    present,
    markedSeeded,
    queued,
    done:
      present === WFEA_BUSINESS_CARDS.length &&
      markedSeeded === WFEA_BUSINESS_CARDS.length &&
      queued === WFEA_BUSINESS_CARDS.length &&
      allContactsPresent,
    cards,
  };
}
