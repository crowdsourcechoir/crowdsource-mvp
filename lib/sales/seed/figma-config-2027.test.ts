import assert from "node:assert/strict";
import { autoSendSkipReason, classifyAutoSendLane } from "@/lib/sales/autosend/policy";
import { resolveBusinessModelFromMetadata } from "@/lib/sales/business-model";
import { extractDomain, isPlausibleEmail, looksLikePersonName } from "@/lib/sales/dedupe";
import { readSalesInitiative } from "@/lib/sales/initiatives";
import { hasEmailSignature } from "@/lib/sales/outreach/signature";
import { classifyQueueCategory } from "@/lib/sales/queue/category";
import {
  FIGMA_CONFIG_2027_SPEC,
  buildFigmaConfigDraft,
  buildFigmaConfigOpportunityMetadata,
  buildFigmaConfigOrgMetadata,
} from "./figma-config-2027";

function main() {
  assert.equal(extractDomain(FIGMA_CONFIG_2027_SPEC.websiteUrl), "figma.com");
  assert.equal(FIGMA_CONFIG_2027_SPEC.opportunity.eventDateEstimate, "2027-05-25");
  assert.equal(FIGMA_CONFIG_2027_SPEC.locationCity, "San Francisco");
  assert.equal(FIGMA_CONFIG_2027_SPEC.contacts.length, 3);

  const primary = FIGMA_CONFIG_2027_SPEC.contacts.find((c) => c.primary);
  assert.ok(primary);
  assert.equal(primary.fullName, "Azra Daniels");
  assert.equal(primary.emailVerificationStatus, "verified_deliverable");

  for (const c of FIGMA_CONFIG_2027_SPEC.contacts) {
    assert.ok(looksLikePersonName(c.fullName));
    assert.ok(isPlausibleEmail(c.email));
    assert.ok(c.email.endsWith("@figma.com"));
  }

  const orgMeta = buildFigmaConfigOrgMetadata(null, "2026-11-18T21:15:00.000Z");
  const oppMeta = buildFigmaConfigOpportunityMetadata(null, "2026-11-18T21:15:00.000Z");
  const initiative = readSalesInitiative(orgMeta);
  assert.equal(initiative, "tech_conferences");

  const category = classifyQueueCategory({
    organizationName: FIGMA_CONFIG_2027_SPEC.organizationName,
    opportunityTitle: FIGMA_CONFIG_2027_SPEC.opportunity.title,
    opportunityTypeKey: FIGMA_CONFIG_2027_SPEC.opportunity.opportunityTypeKey,
    organizationTypeKey: FIGMA_CONFIG_2027_SPEC.organizationTypeKey,
    salesInitiative: initiative,
  });
  assert.equal(category, "tech");

  const model = resolveBusinessModelFromMetadata(oppMeta, orgMeta, {
    salesInitiative: initiative,
    category,
    organizationTypeKey: FIGMA_CONFIG_2027_SPEC.organizationTypeKey,
    opportunityTitle: FIGMA_CONFIG_2027_SPEC.opportunity.title,
  });
  assert.equal(model.businessCategory, "commissioned");
  assert.equal(model.productExperience, "anthem");
  assert.equal(model.dealType, "client_booking");

  const lane = classifyAutoSendLane({
    organizationName: FIGMA_CONFIG_2027_SPEC.organizationName,
    eventTitle: FIGMA_CONFIG_2027_SPEC.opportunity.eventOrInitiativeName,
    organizationTypeKey: FIGMA_CONFIG_2027_SPEC.organizationTypeKey,
    opportunityTypeKey: FIGMA_CONFIG_2027_SPEC.opportunity.opportunityTypeKey,
    salesInitiative: initiative,
    suggestedFee: FIGMA_CONFIG_2027_SPEC.opportunity.suggestedAnthemFee,
  });
  assert.equal(lane, "large");

  const skip = autoSendSkipReason(
    {
      organizationName: FIGMA_CONFIG_2027_SPEC.organizationName,
      organizationTypeKey: FIGMA_CONFIG_2027_SPEC.organizationTypeKey,
      opportunityTypeKey: FIGMA_CONFIG_2027_SPEC.opportunity.opportunityTypeKey,
      salesInitiative: initiative,
      suggestedFee: FIGMA_CONFIG_2027_SPEC.opportunity.suggestedAnthemFee,
      doNotProspect: false,
      existingClient: false,
      alreadyContacted: false,
      duplicateWarning: false,
      eventDate: FIGMA_CONFIG_2027_SPEC.opportunity.eventDateEstimate,
      totalScore: 88,
      audienceScore: 9,
      budgetScore: 9,
      email: primary.email,
      emailVerificationStatus: primary.emailVerificationStatus,
      personName: true,
      draftOpen: true,
      blockedEmail: false,
      queueKind: "initial",
      queueStatus: "pending",
    },
    "2026-11-18"
  );
  assert.equal(skip, null);

  const draft = buildFigmaConfigDraft("Azra Daniels");
  assert.match(draft.subject, /Config 2027/);
  assert.match(draft.subject, /Pier 80/);
  assert.match(draft.body, /^Hi Azra,/);
  assert.match(draft.body, /May 25–27/);
  assert.match(draft.body, /www\.crowdsourcechoir\.com/);
  assert.equal(hasEmailSignature(draft.body), false);

  console.log("figma-config-2027 tests passed");
}

main();
