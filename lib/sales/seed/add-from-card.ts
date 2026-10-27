import { createContact, findExistingContact, updateContact } from "@/lib/sales/db/contacts";
import {
  createOrganization,
  findExistingOrganization,
} from "@/lib/sales/db/organizations";
import { findOrganizationTypeByKey, findOpportunityTypeByKey } from "@/lib/sales/db/lookups";
import {
  createOpportunity,
  findExistingOpportunityByTitle,
  updateOpportunityRelationshipStage,
  updateOpportunityStatus,
} from "@/lib/sales/db/opportunities";
import { isPlausibleEmail, isSendableContact, looksLikePersonName, normalizeEmail } from "@/lib/sales/dedupe";
import {
  SALES_INITIATIVES,
  isSalesInitiativeKey,
  withSalesInitiative,
  type SalesInitiativeKey,
} from "@/lib/sales/initiatives";
import { enqueueOrgManually, type ManualEnqueueResult } from "@/lib/sales/seed/enqueue-manual";
import { verifyEmailAddress } from "@/lib/sales/enrichment/verify-email";
import type { BusinessCardExtract } from "@/lib/sales/card-scan/schema";
import { normalizeCardExtract } from "@/lib/sales/card-scan/extract";
import type { Contact, Organization } from "@/lib/sales/types";

export type AddFromCardInput = BusinessCardExtract & {
  /** Override initiative; defaults to conferences_associations for conference floor capture. */
  salesInitiative?: string | null;
  eventName?: string | null;
};

export type AddFromCardResult = {
  organization: Organization;
  contact: Contact;
  createdOrganization: boolean;
  createdContact: boolean;
  relationshipStage: "interest";
  opportunityId: string;
  queued: boolean;
  queueItemId: string | null;
  message: string;
  manualEnqueue: ManualEnqueueResult | null;
};

function cardImportMeta(input: {
  notes: string | null;
  eventName: string | null;
  confidence: number;
}): Record<string, unknown> {
  return {
    source: "business_card_scan",
    scannedAt: new Date().toISOString(),
    confidence: input.confidence,
    ...(input.notes ? { cardNotes: input.notes } : {}),
    ...(input.eventName ? { eventName: input.eventName } : {}),
  };
}

/**
 * Persist a scanned business card: org + contact, Interest funnel stage,
 * and queue when the email is sendable.
 */
export async function addContactFromBusinessCard(raw: AddFromCardInput): Promise<AddFromCardResult> {
  const extract = normalizeCardExtract(raw);
  const orgName = extract.organizationName?.trim() || extract.fullName?.trim();
  if (!orgName) {
    throw new Error("Need at least an organization or person name from the card.");
  }
  if (!extract.fullName && !extract.email && !extract.phone) {
    throw new Error("Need a name, email, or phone from the card before saving.");
  }

  const initiativeKey: SalesInitiativeKey = isSalesInitiativeKey(raw.salesInitiative)
    ? raw.salesInitiative
    : "conferences_associations";
  const initiative = SALES_INITIATIVES[initiativeKey];
  const orgType = await findOrganizationTypeByKey(initiative.organizationTypeKeys[0]);
  const eventName = raw.eventName?.trim() || null;
  const meta = cardImportMeta({
    notes: extract.notes,
    eventName,
    confidence: extract.confidence,
  });

  let createdOrganization = false;
  let organization = await findExistingOrganization(orgName, extract.websiteUrl);
  if (!organization) {
    organization = await createOrganization({
      name: orgName,
      websiteUrl: extract.websiteUrl,
      organizationTypeId: orgType?.id ?? null,
      source: "manual",
      importMetadata: withSalesInitiative({ ...meta, addedFromCardScan: true }, initiativeKey),
    });
    createdOrganization = true;
  }

  const email = normalizeEmail(extract.email);
  let emailStatus: Contact["emailVerificationStatus"] = "unverified";
  if (email && isPlausibleEmail(email)) {
    const verified = await verifyEmailAddress(email);
    if (verified.status === "invalid") {
      throw new Error(`Hunter says ${email} will bounce — fix the email before saving.`);
    }
    emailStatus = verified.status === "unverified" ? "valid_format" : verified.status;
  }

  const contactName =
    extract.fullName?.trim() ||
    (email ? email.split("@")[0] : null) ||
    "Conference contact";
  if (extract.fullName && !looksLikePersonName(extract.fullName) && !email) {
    // Allow single-token names from cards (e.g. "Madonna") when we have phone/email;
    // otherwise require a clearer name.
    if (!extract.phone) {
      throw new Error("Use a first and last name, or include an email / phone from the card.");
    }
  }

  let createdContact = false;
  let contact = await findExistingContact(organization.id, email, contactName);
  if (contact) {
    contact = await updateContact(contact.id, {
      fullName: contactName,
      roleTitle: extract.roleTitle ?? contact.roleTitle,
      email: email ?? contact.email,
      phone: extract.phone ?? undefined,
      linkedinUrl: extract.linkedinUrl ?? undefined,
      emailVerificationStatus: email ? emailStatus : contact.emailVerificationStatus,
      importMetadata: {
        ...((contact.importMetadata as Record<string, unknown> | null) ?? {}),
        ...meta,
      },
    });
  } else {
    contact = await createContact({
      organizationId: organization.id,
      fullName: contactName,
      roleTitle: extract.roleTitle,
      email: email,
      phone: extract.phone,
      linkedinUrl: extract.linkedinUrl,
      source: "manual",
      emailVerificationStatus: email ? emailStatus : "unverified",
      importMetadata: meta,
    });
    createdContact = true;
  }

  const opportunityTypeKey = initiative.opportunityTypeKeys[0] ?? "annual_conference";
  const oppType = await findOpportunityTypeByKey(opportunityTypeKey);
  const title = eventName ? `${organization.name} · ${eventName}` : organization.name;
  let opportunity = await findExistingOpportunityByTitle(organization.id, title);
  const description = eventName
    ? `Met at ${eventName} — business card scan.`
    : "Met in person — business card scan.";

  if (!opportunity) {
    opportunity = await createOpportunity({
      organizationId: organization.id,
      opportunityTypeId: oppType?.id ?? null,
      title,
      eventOrInitiativeName: eventName,
      description,
      status: "ready_for_review",
      importMetadata: meta,
    });
  } else {
    await updateOpportunityStatus(opportunity.id, "ready_for_review");
  }

  await updateOpportunityRelationshipStage(opportunity.id, "interest");

  let manualEnqueue: ManualEnqueueResult | null = null;
  let queued = false;
  let queueItemId: string | null = null;
  if (isSendableContact(contact)) {
    manualEnqueue = await enqueueOrgManually({
      organization,
      title,
      description,
      eventOrInitiativeName: eventName,
      opportunityTypeKey,
    });
    queueItemId = manualEnqueue.queueItemId;
    queued = true;
    // enqueue may create/reuse opp — keep Interest as the meeting default.
    await updateOpportunityRelationshipStage(manualEnqueue.opportunityId, "interest");
    opportunity = { ...opportunity, id: manualEnqueue.opportunityId };
  }

  const message = queued
    ? `Saved ${contact.fullName} at ${organization.name} → Interest${queueItemId ? " and queue" : ""}.`
    : `Saved ${contact.fullName} at ${organization.name} → Interest. Add a deliverable email to put them in the send queue.`;

  return {
    organization,
    contact,
    createdOrganization,
    createdContact,
    relationshipStage: "interest",
    opportunityId: opportunity.id,
    queued,
    queueItemId,
    message,
    manualEnqueue,
  };
}
