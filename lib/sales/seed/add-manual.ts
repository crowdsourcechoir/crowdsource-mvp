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
import { extractDomain, isGenericMailboxEmail, isPlausibleEmail, isSendableContact, looksLikeGenericRoleName, looksLikePersonName, genericMailboxLabel, normalizeEmail } from "@/lib/sales/dedupe";
import { enrichContactEmail } from "@/lib/sales/enrichment";
import { verifyEmailAddress } from "@/lib/sales/enrichment/verify-email";
import {
  SALES_INITIATIVES,
  isSalesInitiativeKey,
  withSalesInitiative,
  type SalesInitiativeKey,
} from "@/lib/sales/initiatives";
import { ensureContactDrafts, enqueueOrgManually, type ManualEnqueueResult } from "@/lib/sales/seed/enqueue-manual";
import { ensureQueueItemActionable } from "@/lib/sales/outreach/queue-actionable";
import type { Contact, Organization, QueueItemDetail } from "@/lib/sales/types";

export function splitPersonName(fullName: string): { firstName: string; lastName: string } | null {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Resolve a typed name + email into a person or a general inbox (info@ / events@). */
export function parseManualContactInput(
  fullName: string,
  email?: string | null
): { displayName: string | null; email: string | null; isGenericMailbox: boolean } {
  let name = fullName.trim();
  let addr = normalizeEmail(email) ?? "";
  if (!addr && name.includes("@") && isPlausibleEmail(name)) {
    addr = normalizeEmail(name) ?? "";
    name = "";
  }
  if (addr && isGenericMailboxEmail(addr)) {
    const display = looksLikePersonName(name) ? name : name || genericMailboxLabel(addr);
    return { displayName: display, email: addr, isGenericMailbox: true };
  }
  if (!name && !addr) return { displayName: null, email: null, isGenericMailbox: false };
  if (looksLikeGenericRoleName(name) && !addr) {
    throw new Error("Add the inbox email (e.g. events@organization.org).");
  }
  if (!looksLikePersonName(name)) {
    throw new Error("Use a first and last name, or a general inbox like info@ or events@.");
  }
  return {
    displayName: name,
    email: addr && isPlausibleEmail(addr) ? addr : null,
    isGenericMailbox: false,
  };
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
  emailVerificationStatus?: Contact["emailVerificationStatus"];
}): Promise<{ contact: Contact; created: boolean }> {
  const status = input.emailVerificationStatus ?? "unverified";
  const existing = await findExistingContact(input.organizationId, input.email, input.fullName);
  if (existing) {
    const contact = await updateContact(existing.id, {
      fullName: input.fullName,
      roleTitle: input.roleTitle ?? existing.roleTitle,
      email: input.email,
      emailVerificationStatus: status,
    });
    return { contact, created: false };
  }
  const contact = await createContact({
    organizationId: input.organizationId,
    fullName: input.fullName,
    roleTitle: input.roleTitle,
    email: input.email,
    source: "manual",
    emailVerificationStatus: status,
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

  const parsed = parseManualContactInput(input.contactFullName ?? "", input.contactEmail ?? null);
  const contactName = parsed.displayName ?? "";
  let email = parsed.email ?? "";
  let hunter = { attempted: false, found: false, error: null as string | null };

  if (contactName && !email && looksLikePersonName(contactName) && !parsed.isGenericMailbox) {
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
  if (email && isPlausibleEmail(email) && (parsed.isGenericMailbox || looksLikePersonName(contactName))) {
    const verified = await verifyEmailAddress(email);
    if (verified.status === "invalid") {
      hunter.error = `Hunter says ${email} will bounce.`;
      email = "";
    } else {
      const upserted = await upsertNamedContact({
        organizationId: organization.id,
        fullName: contactName || genericMailboxLabel(email),
        email,
        roleTitle: input.contactRoleTitle?.trim() || (parsed.isGenericMailbox ? "General inbox" : null),
        emailVerificationStatus: verified.status === "unverified" ? "valid_format" : verified.status,
      });
      contact = upserted.contact;
    }
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
  if (contact && isSendableContact(contact)) {
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
      ? `${organization.name} saved. ${hunter.error}`
      : contact?.email
        ? `${organization.name} saved. ${contact.fullName} is not Hunter-verified as deliverable yet, so they were not queued.`
        : `${organization.name} saved. Add an email (or a website so Hunter can find it) to put this in the queue.`
    : `${organization.name} saved. Add a named contact or a general inbox like info@ / events@ to put it in the queue.`;

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
  const actionable = await ensureQueueItemActionable(item);
  const opportunity = await getOpportunity(actionable.opportunityId);
  if (!opportunity) throw new Error("Opportunity not found.");
  const organization = await getOrganization(opportunity.organizationId);
  if (!organization) throw new Error("Organization not found.");

  const parsed = parseManualContactInput(input.fullName, input.email ?? null);
  if (!parsed.displayName && !parsed.email) {
    throw new Error("Use a first and last name, or a general inbox like info@ or events@.");
  }
  const fullName = parsed.displayName ?? "";
  let email = parsed.email ?? "";
  let hunter = { attempted: false, found: false, error: null as string | null };
  if (!email && looksLikePersonName(fullName) && !parsed.isGenericMailbox) {
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
      detail: await assembleQueueItemDetailFromQueueItem(actionable),
      message: hunter.error ?? "Contact saved without an email — add one to draft outreach.",
    };
  }

  const verified = await verifyEmailAddress(email);
  if (verified.status === "invalid") {
    const contact = await createContact({
      organizationId: organization.id,
      fullName,
      roleTitle: input.roleTitle?.trim() || null,
      email,
      source: "manual",
      emailVerificationStatus: "invalid",
    });
    return {
      contact,
      hunter,
      selected: false,
      detail: await assembleQueueItemDetailFromQueueItem(actionable),
      message: `Saved ${fullName} but Hunter says ${email} will bounce — not added to the send list.`,
    };
  }

  const { contact } = await upsertNamedContact({
    organizationId: organization.id,
    fullName: fullName || genericMailboxLabel(email),
    email,
    roleTitle: input.roleTitle?.trim() || (parsed.isGenericMailbox ? "General inbox" : null),
    emailVerificationStatus: verified.status === "unverified" ? "valid_format" : verified.status,
  });

  if (!parsed.isGenericMailbox && verified.status !== "verified_deliverable") {
    return {
      contact,
      hunter,
      selected: false,
      detail: await assembleQueueItemDetailFromQueueItem(actionable),
      message: `Saved ${contact.fullName} (${email}) but Hunter could not confirm deliverability (${verified.hunterStatus ?? verified.status}) — not queued to send.`,
    };
  }

  const created = await ensureContactDrafts({
    organization,
    opportunityId: opportunity.id,
    pipelineRunId: null,
  });
  const draft = created.drafts.find((d) => d.contactId === contact.id) ?? created.primaryDraft;
  await setQueueItemOutreachDraft(actionable.id, draft.id);
  const refreshed = await getQueueItem(actionable.id);
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
