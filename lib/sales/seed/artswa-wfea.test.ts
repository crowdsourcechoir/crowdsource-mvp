import assert from "node:assert/strict";
import { resolveBusinessModelFromMetadata } from "@/lib/sales/business-model";
import { isPlausibleEmail, looksLikePersonName } from "@/lib/sales/dedupe";
import { readSalesInitiative } from "@/lib/sales/initiatives";
import { classifyOutreachPersona } from "@/lib/sales/outreach/persona";
import { hasEmailSignature } from "@/lib/sales/outreach/signature";
import { classifyQueueCategory } from "@/lib/sales/queue/category";
import { classifyWorkstream } from "@/lib/sales/strategy/playbook";
import {
  ARTSWA_WFEA_CARD,
  buildArtsWaOpportunityMetadata,
  buildArtsWaOrganizationMetadata,
  buildArtsWaWfeaDraft,
} from "./artswa-wfea";

function main() {
  assert.equal(ARTSWA_WFEA_CARD.contact.fullName, "Aaron Semer");
  assert.equal(ARTSWA_WFEA_CARD.contact.roleTitle, "Creative Districts Program Manager");
  assert.equal(ARTSWA_WFEA_CARD.contact.email, "aaron.semer@arts.wa.gov");
  assert.ok(isPlausibleEmail(ARTSWA_WFEA_CARD.contact.email));
  assert.ok(looksLikePersonName(ARTSWA_WFEA_CARD.contact.fullName));
  assert.match(ARTSWA_WFEA_CARD.contact.phone, /360-252-9982/);
  assert.match(ARTSWA_WFEA_CARD.contact.phone, /360-821-3840/);
  assert.equal(ARTSWA_WFEA_CARD.locationCity, "Olympia");
  assert.equal(ARTSWA_WFEA_CARD.locationRegion, "WA");
  assert.equal(ARTSWA_WFEA_CARD.websiteUrl, "https://www.arts.wa.gov");

  assert.equal(classifyOutreachPersona(ARTSWA_WFEA_CARD.contact.roleTitle), "program_manager");

  const orgMeta = buildArtsWaOrganizationMetadata(null, "2026-11-17T22:25:00.000Z");
  const oppMeta = buildArtsWaOpportunityMetadata(null, "2026-11-17T22:25:00.000Z");
  const salesInitiative = readSalesInitiative(orgMeta);
  assert.equal(salesInitiative, "wfea_network");

  const category = classifyQueueCategory({
    organizationName: ARTSWA_WFEA_CARD.organizationName,
    opportunityTitle: ARTSWA_WFEA_CARD.opportunity.title,
    opportunityTypeKey: ARTSWA_WFEA_CARD.opportunity.opportunityTypeKey,
    organizationTypeKey: ARTSWA_WFEA_CARD.organizationTypeKey,
    salesInitiative,
  });
  assert.equal(category, "other");

  const workstream = classifyWorkstream({
    revenueEngine: oppMeta.revenueEngine as string,
    salesInitiative,
    category,
    organizationTypeKey: ARTSWA_WFEA_CARD.organizationTypeKey,
  });
  assert.equal(workstream, "partnership");

  const model = resolveBusinessModelFromMetadata(oppMeta, orgMeta, {
    revenueEngine: oppMeta.revenueEngine as string,
    salesInitiative,
    category,
    organizationTypeKey: ARTSWA_WFEA_CARD.organizationTypeKey,
    workstream,
    opportunityTitle: ARTSWA_WFEA_CARD.opportunity.title,
  });
  assert.equal(model.businessCategory, "commissioned");
  assert.equal(model.productExperience, "custom_activation");
  assert.equal(model.dealType, "strategic_partnership");
  assert.equal(model.editionBloom, "Washington Creative Districts");

  const draft = buildArtsWaWfeaDraft();
  assert.match(draft.subject, /WFEA/);
  assert.match(draft.subject, /Creative Districts/);
  assert.match(draft.body, /^Hi Aaron,/);
  assert.match(draft.body, /WFEA/);
  assert.match(draft.body, /Creative Districts/);
  assert.equal(hasEmailSignature(draft.body), false);

  console.log("artswa-wfea tests passed");
}

main();
