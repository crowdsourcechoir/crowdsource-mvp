import { createContact, findExistingContact, updateContact } from "@/lib/sales/db/contacts";
import {
  createOrganization,
  findExistingOrganization,
  getOrganization,
} from "@/lib/sales/db/organizations";
import { findOrganizationTypeByKey } from "@/lib/sales/db/lookups";
import { assembleQueueItemDetailFromQueueItem } from "@/lib/sales/db/assemble";
import { getQueueItem, setQueueItemOutreachDraft } from "@/lib/sales/db/queue";
import { getOpportunity } from "@/lib/sales/db/opportunities";
import { extractDomain, isPlausibleEmail, looksLikePersonName } from "@/lib/sales/dedupe";
import { enrichContactEmail } from "@/lib/sales/enrichment";
import {
  SALES_INITIATIVES,
  isSalesInitiativeKey,
  withSalesInitiative,
  type SalesInitiativeKey,
} from "@/lib/sales/initiatives";
import { enqueueOrgManually, ensureContactDrafts, type ManualEnqueueResult } from "@/lib/sales/seed/enqueue-manual";
import type { Contact, Organization, QueueItemDetail } from "@/lib/sales/types";

export function splitPersonName(fullName: string): { firstName: string; lastName: string } | null {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function hunterFindEmail(
  fullName: string,
  domainOrUrl: string | null | undefined
): Promise<{ email: string | null; creditsUsed: boolean; error: string | null }> {
  const names = splitPersonName(fullName);
  const domain = extractDomain(domainOrUrl ?? null);
  if (!names) return { email: null, creditsUsed: false, error: "Use a first and last name." };
  if (!domain) {
    return { email: null, creditsUsed: false, error: "Need a website/domain for Hunter, or type the email." };
  }
  const result = await enrichContactEmail({
    firstName: names.firstName,
    lastName: names.lastName,
    domain,
  });
  if (!result) return { email: null, creditsUsed: false, error: "HUNTER_API_KEY is missing." };
  if (result.status === "error") {
    return { email: null, creditsUsed: false, error: result.error ?? "Hunter lookup failed." };
  }
  return {
    email: result.email,
    creditsUsed: result.status === "found",
    error: result.status === "not_found" ? "Hunter did not find an email." : null,
  };
}

async function upsertNamedContact(input: {
  organizationId: string;
  fullName: string;
  email: string;
  roleTitle: string | null;
}): Promise<{ contact: Contact; created: boolean }> {
  const existing = await findExistingContact(input.organizationId, input.email, input.fullName);
  if (existing) {
    const contact = await updateContact(existing.id, {
      fullName: input.fullName,
      roleTitle: input.roleTitle ?? existing.roleTitle,
      email: input.email,
      emailVerificationStatus: "valid_format",
    });
    return { contact, created: false };
  }
  const contact = await createContact({
    organizationId: input.organizationId,
    fullName: input.fullName,
    roleTitle: input.roleTitle,
    email: input.email,
    source: "manual",
    emailVerificationStatus: "valid_format",
  });
  return { contact, created: true };
}

export type AddOrgQuickInput = {
  name: string;
  websiteUrl?: string | null;
  salesInitiative?: string | null;
  contactFullName?: string | null;
  contactEmail?: string | null;
  contactRoleTitle?: string | null;
};

export type AddOrgQuickResult = {
  organization: Organization;
  created: boolean;
  contact: Contact | null;
  hunter: { attempted: boolean; found: boolean; error: string | null };
  queued: boolean;
  queueItemId: string | null;
  message: string;
  manualEnqueue: ManualEnqueueResult | null;
};

export async function addOrganizationQuick(input: AddOrgQuickInput): Promise<AddOrgQuickResult> {
  const name = input.name.trim();
  if (!name) throw new Error("Organization name is required.");
  const websiteUrl = input.websiteUrl?.trim() || null;
  const initiative = isSalesInitiativeKey(input.salesInitiative) ? input.salesInitiative : null;
  const orgTypeKey = initiative ? SALES_INITIATIVES[initiative].organizationTypeKeys[0] : undefined;
  const orgType = orgTypeKey ? await findOrganizationTypeByKey(orgTypeKey) : null;

  let created = false;
  let organization = await findExistingOrganization(name, websiteUrl);
  if (!organization) {
    organization = await createOrganization({
      name,
      websiteUrl,
      organizationTypeId: orgType?.id ?? null,
      source: "manual",
      importMetadata: initiative ? withSalesInitiative({ addedFromQueue: true }, initiative) : { addedFromQueue: true },
    });
    created = true;
  }

  const contactName = input.contactFullName?.trim() || "";
  let email = input.contactEmail?.trim().toLowerCase() || "";
  let hunter = { attempted: false, found: false, error: null as string | null };

  if (contactName && !email) {
    hunter.attempted = true;
    const found = await hunterFindEmail(contactName, websiteUrl);
    hunter.error = found.error;
    if (found.email) {
      email = found.email;
      hunter.found = true;
      hunter.error = null;
    }
  }

  let contact: Contact | null = null;
  if (contactName && email && isPlausibleEmail(email)) {
    if (!looksLikePersonName(contactName)) {
      throw new Error("Contact needs a first and last name.");
    }
    const upserted = await upsertNamedContact({
      organizationId: organization.id,
      fullName: contactName,
      email,
      roleTitle: input.contactRoleTitle?.trim() || null,
    });
    contact = upserted.contact;
  } else if (contactName && !email) {
    // Persist the named person even without email so Joel can fill it later.
    if (looksLikePersonName(contactName)) {
      const existing = await findExistingContact(organization.id, null, contactName);
      if (!existing) {
        contact = await createContact({
          organizationId: organization.id,
          fullName: contactName,
          roleTitle: input.contactRoleTitle?.trim() || null,
          source: "manual",
          emailVerificationStatus: "unverified",
        });
      } else {
        contact = existing;
      }
    }
  }

  let manualEnqueue: ManualEnqueueResult | null = null;
  if (contact && isPlausibleEmail(contact.email) && looksLikePersonName(contact.fullName)) {
    const opportunityTypeKey = initiative
      ? SALES_INITIATIVES[initiative as SalesInitiativeKey].opportunityTypeKeys[0]
      : "fan_engagement_initiative";
    manualEnqueue = await enqueueOrgManually({
      organization,
      title: organization.name,
      description: "Manually added from the sales queue.",
      opportunityTypeKey,
    });
    return {
      organization,
      created,
      contact,
      hunter,
      queued: true,
      queueItemId: manualEnqueue.queueItemId,
      message: hunter.found
        ? `Added ${organization.name} and queued ${contact.fullName} (Hunter found ${contact.email}).`
        : `Added ${organization.name} and queued ${contact.fullName}.`,
      manualEnqueue,
    };
  }

  const message = contactName
    ? hunter.error
      ? `${organization.name} saved. ${hunter.error} Add an email to put them in the queue.`
      : `${organization.name} saved. Add an email (or a website so Hunter can find it) to put this in the queue.`
    : `${organization.name} saved. Add a named contact to put it in the queue.`;

  return {
    organization,
    created,
    contact,
    hunter,
    queued: false,
    queueItemId: null,
    message,
    manualEnqueue: null,
  };
}

export type AddQueueContactResult = {
  contact: Contact;
  hunter: { attempted: boolean; found: boolean; error: string | null };
  selected: boolean;
  detail: QueueItemDetail | null;
  message: string;
};

export async function addContactToQueueItem(input: {
  itemId: string;
  fullName: string;
  email?: string | null;
  roleTitle?: string | null;
}): Promise<AddQueueContactResult> {
  const item = await getQueueItem(input.itemId);
  if (!item) throw new Error("Queue item not found.");
  if (item.status !== "pending") throw new Error("Queue item already decided.");
  const opportunity = await getOpportunity(item.opportunityId);
  if (!opportunity) throw new Error("Opportunity not found.");
  const organization = await getOrganization(opportunity.organizationId);
  if (!organization) throw new Error("Organization not found.");

  const fullName = input.fullName.trim();
  if (!looksLikePersonName(fullName)) {
    throw new Error("Use a first and last name.");
  }

  let email = input.email?.trim().toLowerCase() || "";
  let hunter = { attempted: false, found: false, error: null as string | null };
  if (!email) {
    hunter.attempted = true;
    const found = await hunterFindEmail(fullName, organization.websiteUrl ?? organization.domain);
    hunter.error = found.error;
    if (found.email) {
      email = found.email;
      hunter.found = true;
      hunter.error = null;
    }
  }

  if (!email || !isPlausibleEmail(email)) {
    const contact = await createContact({
      organizationId: organization.id,
      fullName,
      roleTitle: input.roleTitle?.trim() || null,
      source: "manual",
      emailVerificationStatus: "unverified",
    });
    return {
      contact,
      hunter,
      selected: false,
      detail: await assembleQueueItemDetailFromQueueItem(item),
      message: hunter.error ?? "Contact saved without an email — add one to draft outreach.",
    };
  }

  const { contact } = await upsertNamedContact({
    organizationId: organization.id,
    fullName,
    email,
    roleTitle: input.roleTitle?.trim() || null,
  });

  const created = await ensureContactDrafts({
    organization,
    opportunityId: opportunity.id,
    pipelineRunId: null,
  });
  const draft = created.drafts.find((d) => d.contactId === contact.id) ?? created.primaryDraft;
  await setQueueItemOutreachDraft(item.id, draft.id);
  const refreshed = await getQueueItem(item.id);
  const detail = refreshed ? await assembleQueueItemDetailFromQueueItem(refreshed) : null;

  return {
    contact,
    hunter,
    selected: true,
    detail,
    message: hunter.found
      ? `Added ${contact.fullName} — Hunter found ${contact.email}.`
      : `Added ${contact.fullName}.`,
  };
}
