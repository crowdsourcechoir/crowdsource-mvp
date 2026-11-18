import assert from "node:assert/strict";
import { classifyAutoSendLane } from "@/lib/sales/autosend/policy";
import { resolveBusinessModelFromMetadata } from "@/lib/sales/business-model";
import { isPlausibleEmail } from "@/lib/sales/dedupe";
import { resolveFlagshipOffer, resolveRevenueEngine } from "@/lib/sales/engines";
import { readSalesInitiative } from "@/lib/sales/initiatives";
import { matchesQueueDeal } from "@/lib/sales/queue/deal-type";
import { matchesQueueWorkstream } from "@/lib/sales/queue/workstream";
import { classifyWorkstream } from "@/lib/sales/strategy/playbook";
import { decideAccess } from "@/lib/operators/access";
import {
  EE_FUNDRAISING_CONTACTS,
  EE_FUNDRAISING_EVENT_NAME,
  EE_FUNDRAISING_NAME,
  EE_FUNDRAISING_OPPORTUNITY_TITLE,
  buildEeFundraisingDraftCopy,
  buildEeFundraisingPartnershipMetadata,
} from "./ee-fundraising-partnership";

function main() {
  assert.equal(EE_FUNDRAISING_NAME, "E + E Fundraising & Events");
  assert.equal(EE_FUNDRAISING_EVENT_NAME, "WFEA 2026 Annual Conference");
  assert.equal(EE_FUNDRAISING_CONTACTS.length, 2);

  const liz = EE_FUNDRAISING_CONTACTS[0]!;
  assert.equal(liz.fullName, "Liz DeBord");
  assert.equal(liz.email, "liz@eefundraising.com");
  assert.equal(liz.phone, "(206) 658-3229");
  assert.equal(liz.roleTitle, "Event Production & Management");
  assert.equal(liz.primary, true);
  assert.equal(liz.emailVerificationStatus, "valid_format");
  assert.equal(isPlausibleEmail(liz.email), true);

  const julianne = EE_FUNDRAISING_CONTACTS[1]!;
  assert.equal(julianne.fullName, "Julianne Read");
  assert.equal(julianne.email, "julianne@eefundraising.com");
  assert.equal(julianne.primary, false);
  assert.equal(isPlausibleEmail(julianne.email), true);

  const meta = buildEeFundraisingPartnershipMetadata();
  const revenueEngine = resolveRevenueEngine(meta, meta);
  const flagshipOffer = resolveFlagshipOffer(meta, meta);
  const salesInitiative = readSalesInitiative(meta);
  assert.equal(revenueEngine, "partnership");
  assert.equal(flagshipOffer, "crowdsource_partnership");
  assert.equal(salesInitiative, "wfea_network");

  const workstream = classifyWorkstream({
    revenueEngine,
    flagshipOffer,
    salesInitiative,
    organizationTypeKey: "event_agency",
  });
  assert.equal(workstream, "partnership");
  assert.equal(matchesQueueWorkstream({ workstream }, "partnership"), true);

  const model = resolveBusinessModelFromMetadata(meta, meta, {
    revenueEngine,
    flagshipOffer,
    salesInitiative,
    organizationTypeKey: "event_agency",
    workstream,
    opportunityTitle: EE_FUNDRAISING_OPPORTUNITY_TITLE,
  });
  assert.equal(model.businessCategory, "commissioned");
  assert.equal(model.productExperience, "anthem");
  assert.equal(model.dealType, "strategic_partnership");
  assert.equal(matchesQueueDeal({ dealType: model.dealType }, "strategic_partnership"), true);

  const lane = classifyAutoSendLane({
    organizationName: EE_FUNDRAISING_NAME,
    eventTitle: EE_FUNDRAISING_OPPORTUNITY_TITLE,
    organizationTypeKey: "event_agency",
    salesInitiative,
    dealType: model.dealType,
  });
  assert.equal(lane, "partnership");

  const lizDraft = buildEeFundraisingDraftCopy("Liz DeBord");
  assert.match(lizDraft.subject, /WFEA/);
  assert.match(lizDraft.body, /^Hi Liz,/);
  assert.match(lizDraft.body, /WFEA conference/);
  assert.match(lizDraft.body, /partner/i);
  assert.match(lizDraft.body, /www\.crowdsourcechoir\.com/);
  assert.doesNotMatch(lizDraft.body, /\/book/);
  assert.match(lizDraft.body, /Best,\nJoel$/);

  const julianneDraft = buildEeFundraisingDraftCopy("Julianne Read");
  assert.match(julianneDraft.body, /^Hi Julianne,/);
  assert.match(julianneDraft.body, /Liz DeBord/);
  assert.match(julianneDraft.body, /Best,\nJoel$/);

  assert.equal(
    decideAccess("/api/sales/cron/seed-ee-fundraising-partnership", "GET", new URLSearchParams("status=1"), null).kind,
    "public"
  );

  console.log("ee-fundraising-partnership tests passed");
}

main();
