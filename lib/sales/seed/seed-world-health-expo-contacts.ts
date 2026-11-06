import { createContact, findExistingContact, listContactsForOrganization, updateContact } from "@/lib/sales/db/contacts";
import { findOrganizationTypeByKey } from "@/lib/sales/db/lookups";
import { listOpportunitiesForOrganization } from "@/lib/sales/db/opportunities";
import {
  createOrganization,
  findExistingOrganization,
  updateOrganization,
} from "@/lib/sales/db/organizations";
import { createOrUpdateQueueItem, getInitialQueueItemByOpportunity } from "@/lib/sales/db/queue";
import { withSalesInitiative } from "@/lib/sales/initiatives";
import { ensureContactDrafts, enqueueOrgManually } from "@/lib/sales/seed/enqueue-manual";
import {
  WORLD_HEALTH_EXPO_CONTACTS,
  WORLD_HEALTH_EXPO_EVENT_DATE,
  WORLD_HEALTH_EXPO_EVENT_NAME,
  WORLD_HEALTH_EXPO_NAME,
  WORLD_HEALTH_EXPO_NAME_CANDIDATES,
  WORLD_HEALTH_EXPO_QUEUE_DESCRIPTION,
  WORLD_HEALTH_EXPO_QUEUE_TITLE,
  WORLD_HEALTH_EXPO_WEBSITE,
  type WorldHealthExpoContact,
} from "@/lib/sales/seed/world-health-expo-contacts";
import type { Contact, Organization } from "@/lib/sales/types";

const SEEDED_FLAG = "worldHealthExpoContactsSeeded";

export type SeedWorldHealthExpoResult = {
  ok: boolean;
  skipped: boolean;
  createdOrganization: boolean;
  organizationId: string | null;
  organizationName: string | null;
  contactsCreated: number;
  contactsUpdated: number;
  queueItemId: string | null;
  contacts: Array<{ fullName: string; email: string | null; roleTitle: string }>;
  error: string | null;
};

function emptyResult(error: string | null, partial?: Partial<SeedWorldHealthExpoResult>): SeedWorldHealthExpoResult {
  return {
    ok: !error,
    skipped: false,
    createdOrganization: false,
    organizationId: null,
    organizationName: null,
    contactsCreated: 0,
    contactsUpdated: 0,
    queueItemId: null,
    contacts: [],
    error,
    ...partial,
  };
}

export async function findWorldHealthExpoOrganization(): Promise<Organization | null> {
  const bySite = await findExistingOrganization(WORLD_HEALTH_EXPO_NAME, WORLD_HEALTH_EXPO_WEBSITE);
  if (bySite) return bySite;
  for (const name of WORLD_HEALTH_EXPO_NAME_CANDIDATES) {
    const org = await findExistingOrganization(name);
    if (org) return org;
  }
  return null;
}

function verificationStatus(
  existing: Contact | null,
  email: string | null
): Contact["emailVerificationStatus"] {
  if (!email) {
    if (existing?.email) return existing.emailVerificationStatus;
    return "unverified";
  }
  const current = existing?.emailVerificationStatus;
  if (current === "invalid" || current === "verified_deliverable" || current === "risky") return current;
  // Published address, syntax only. Hunter's verifier quota was exhausted, so this is not an SMTP pass.
  return "valid_format";
}

async function upsertContact(
  organizationId: string,
  spec: WorldHealthExpoContact
): Promise<"created" | "updated"> {
  const email = spec.email?.trim().toLowerCase() || null;
  const existing = await findExistingContact(organizationId, email, spec.fullName);
  const importMetadata = {
    ...(existing?.importMetadata ?? {}),
    seededManually: true,
    worldHealthExpoContact: true,
    roleDescription: spec.roleDescription,
    publishedReach: true,
    smtpChecked: false,
  };
  const emailVerificationStatus = verificationStatus(existing, email);

  if (existing) {
    await updateContact(existing.id, {
      fullName: spec.fullName,
      roleTitle: spec.roleTitle,
      roleCategory: spec.roleCategory,
      // A later-found direct email for Enjy should survive a re-seed that still has none.
      ...(email ? { email, emailVerificationStatus } : { emailVerificationStatus }),
      importMetadata,
    });
    return "updated";
  }

  await createContact({
    organizationId,
    fullName: spec.fullName,
    roleTitle: spec.roleTitle,
    roleCategory: spec.roleCategory,
    email,
    source: "manual",
    emailVerificationStatus,
    importMetadata,
  });
  return "created";
}

/**
 * Attach the WHX doorway contacts to the existing World Health Expo org, or create
 * that org when none of the known names / worldhealthexpo.com domain match.
 * Idempotent: a second run is a no-op unless `force` is set.
 */
export async function seedWorldHealthExpoContacts(options?: {
  force?: boolean;
}): Promise<SeedWorldHealthExpoResult> {
  const force = Boolean(options?.force);
  let organization = await findWorldHealthExpoOrganization();
  const meta = (organization?.importMetadata ?? {}) as Record<string, unknown>;
  if (organization && !force && meta[SEEDED_FLAG] === true) {
    return emptyResult(null, {
      ok: true,
      skipped: true,
      organizationId: organization.id,
      organizationName: organization.name,
    });
  }

  let createdOrganization = false;
  if (!organization) {
    const orgType = await findOrganizationTypeByKey("conference");
    organization = await createOrganization({
      name: WORLD_HEALTH_EXPO_NAME,
      websiteUrl: WORLD_HEALTH_EXPO_WEBSITE,
      locationCity: "Dubai",
      locationCountry: "AE",
      organizationTypeId: orgType?.id ?? null,
      source: "manual",
      isExistingClient: false,
      importMetadata: withSalesInitiative({ seededWithContacts: true }, "conferences_associations"),
    });
    createdOrganization = true;
  }

  let contactsCreated = 0;
  let contactsUpdated = 0;
  for (const spec of WORLD_HEALTH_EXPO_CONTACTS) {
    const outcome = await upsertContact(organization.id, spec);
    if (outcome === "created") contactsCreated += 1;
    else contactsUpdated += 1;
  }

  const opportunities = await listOpportunitiesForOrganization(organization.id);
  const queuedOpportunities = [];
  for (const candidate of opportunities) {
    const item = await getInitialQueueItemByOpportunity(candidate.id);
    if (item) queuedOpportunities.push({ opportunity: candidate, item });
  }
  const open =
    queuedOpportunities.find((row) => row.item.status === "pending") ?? queuedOpportunities[0] ?? null;
  let queueItemId: string | null = null;

  if (!open) {
    const opportunity = opportunities[0] ?? null;
    const queued = await enqueueOrgManually({
      organization,
      title: opportunity?.title ?? WORLD_HEALTH_EXPO_QUEUE_TITLE,
      description: opportunity?.description ?? WORLD_HEALTH_EXPO_QUEUE_DESCRIPTION,
      eventOrInitiativeName: opportunity?.eventOrInitiativeName ?? WORLD_HEALTH_EXPO_EVENT_NAME,
      eventDateEstimate: opportunity?.eventDateEstimate ?? WORLD_HEALTH_EXPO_EVENT_DATE,
      eventDateConfidence: opportunity?.eventDateConfidence ?? "confirmed",
      opportunityTypeKey: "annual_conference",
      totalScoreHint: 78,
    });
    queueItemId = queued.queueItemId;
  } else {
    const drafts = await ensureContactDrafts({
      organization,
      opportunityId: open.opportunity.id,
      opportunityTypeKey: "annual_conference",
      eventName: open.opportunity.eventOrInitiativeName ?? WORLD_HEALTH_EXPO_EVENT_NAME,
    });
    if (open.item.status === "pending") {
      const refreshed = await createOrUpdateQueueItem({
        opportunityId: open.opportunity.id,
        outreachDraftId: open.item.outreachDraftId ?? drafts.primaryDraft.id,
        prospectScoreId: open.item.prospectScoreId,
        touchCreatedAt: contactsCreated > 0,
      });
      queueItemId = refreshed.id;
    } else {
      queueItemId = open.item.id;
    }
  }

  const latest = (await findWorldHealthExpoOrganization()) ?? organization;
  await updateOrganization(latest.id, {
    importMetadata: {
      ...(latest.importMetadata ?? {}),
      [SEEDED_FLAG]: true,
      worldHealthExpoContactsSeededAt: new Date().toISOString(),
    },
  });

  const stored = await listContactsForOrganization(latest.id);
  const wanted = new Set(WORLD_HEALTH_EXPO_CONTACTS.map((c) => c.fullName.toLowerCase()));
  const contacts = stored
    .filter((c) => c.fullName && wanted.has(c.fullName.toLowerCase()))
    .map((c) => ({
      fullName: c.fullName ?? "",
      email: c.email,
      roleTitle: c.roleTitle ?? "",
    }));

  return {
    ok: true,
    skipped: false,
    createdOrganization,
    organizationId: latest.id,
    organizationName: latest.name,
    contactsCreated,
    contactsUpdated,
    queueItemId,
    contacts,
    error: null,
  };
}

/** Names and counts only — safe for the public cron status check. */
export async function getWorldHealthExpoContactStatus(): Promise<{
  present: boolean;
  markedSeeded: boolean;
  organizationName: string | null;
  contactCount: number;
  matchedContactNames: string[];
  done: boolean;
}> {
  const organization = await findWorldHealthExpoOrganization();
  if (!organization) {
    return {
      present: false,
      markedSeeded: false,
      organizationName: null,
      contactCount: 0,
      matchedContactNames: [],
      done: false,
    };
  }
  const meta = (organization.importMetadata ?? {}) as Record<string, unknown>;
  const stored = await listContactsForOrganization(organization.id);
  const wanted = new Set(WORLD_HEALTH_EXPO_CONTACTS.map((c) => c.fullName.toLowerCase()));
  const matchedContactNames = stored
    .map((c) => c.fullName)
    .filter((name): name is string => Boolean(name && wanted.has(name.toLowerCase())));
  const markedSeeded = meta[SEEDED_FLAG] === true;
  return {
    present: true,
    markedSeeded,
    organizationName: organization.name,
    contactCount: stored.length,
    matchedContactNames,
    done: markedSeeded && matchedContactNames.length === WORLD_HEALTH_EXPO_CONTACTS.length,
  };
}
