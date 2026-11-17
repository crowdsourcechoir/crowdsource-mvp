import { listContactsForOrganization } from "../db/contacts";
import { findOpportunityTypeByKey } from "../db/lookups";
import {
  createOpportunity,
  findExistingOpportunityByTitle,
} from "../db/opportunities";
import { createOrUpdateQueueItem } from "../db/queue";
import { updateOrganization } from "../db/organizations";
import { isSendableContact } from "../dedupe";
import { readSalesInitiative, SALES_INITIATIVES } from "../initiatives";
import type { Organization } from "../types";
import { enqueueOrgManually } from "./enqueue-manual";

/**
 * Put an organization on the approval queue from its page.
 * A named contact without an email still gets an opportunity and a queue row
 * so follow-up, notes, and context have somewhere to live. A draft is created
 * only when a contact can actually be emailed.
 */
export async function queueOrganizationFromPage(organization: Organization): Promise<{
  queueItemId: string;
  opportunityId: string;
  message: string;
}> {
  const contacts = await listContactsForOrganization(organization.id);
  const title = organization.name.trim() || "Opportunity";
  if (contacts.some((contact) => isSendableContact(contact))) {
    const queued = await enqueueOrgManually({
      organization,
      title,
      description: "Queued from the organization page.",
    });
    return {
      queueItemId: queued.queueItemId,
      opportunityId: queued.opportunityId,
      message: "In the queue, with a draft.",
    };
  }

  const initiative = readSalesInitiative(organization.importMetadata);
  const typeKey = initiative ? SALES_INITIATIVES[initiative].opportunityTypeKeys[0] : "fan_engagement_initiative";
  const oppType = await findOpportunityTypeByKey(typeKey);
  let opportunity = await findExistingOpportunityByTitle(organization.id, title);
  if (!opportunity) {
    opportunity = await createOpportunity({
      organizationId: organization.id,
      opportunityTypeId: oppType?.id ?? null,
      title,
      description: "Tracked from the organization page. Add an email when you have one.",
      status: "ready_for_review",
      importMetadata: { enqueuedManually: true, reason: "organization_page_follow_up" },
    });
  }

  const queueItem = await createOrUpdateQueueItem({
    opportunityId: opportunity.id,
    outreachDraftId: null,
    prospectScoreId: null,
    reopenDecided: true,
    touchCreatedAt: true,
  });

  await updateOrganization(organization.id, {
    importMetadata: {
      ...(organization.importMetadata ?? {}),
      operatorQueuedAt: new Date().toISOString(),
    },
  }).catch(() => undefined);

  return {
    queueItemId: queueItem.id,
    opportunityId: opportunity.id,
    message: "In the queue. Add an email when you have one — there’s no draft yet.",
  };
}
