import assert from "node:assert/strict";
import { looksLikePersonName, isPlausibleEmail } from "@/lib/sales/dedupe";
import { autoSendSkipReason, classifyAutoSendLane } from "@/lib/sales/autosend/policy";
import { KEY_2027_PROSPECT_SEEDS } from "./key-2027-prospects";

function main() {
  assert.ok(KEY_2027_PROSPECT_SEEDS.length >= 25, "expected at least 25 net-new 2027 prospects");

  const seenNames = new Set<string>();
  const seenEmails = new Set<string>();

  for (const seed of KEY_2027_PROSPECT_SEEDS) {
    assert.equal(seenNames.has(seed.name.toLowerCase()), false, `duplicate org: ${seed.name}`);
    seenNames.add(seed.name.toLowerCase());
    assert.ok(seed.suggestedAnthemFee >= 15_000, `below $15k: ${seed.name}`);
    assert.ok(seed.contacts.length >= 1, `missing contacts: ${seed.name}`);

    const primary = seed.contacts[0]!;
    assert.equal(looksLikePersonName(primary.fullName), true, `not a person name on ${seed.name}: ${primary.fullName}`);
    assert.equal(isPlausibleEmail(primary.email), true, `bad email on ${seed.name}: ${primary.email}`);
    assert.equal(seenEmails.has(primary.email.toLowerCase()), false, `duplicate primary email: ${primary.email}`);
    seenEmails.add(primary.email.toLowerCase());

    const laneInput = {
      organizationName: seed.name,
      eventTitle: seed.manualEventName ?? seed.manualQueueTitle,
      organizationTypeKey: seed.organizationTypeKey ?? null,
      opportunityTypeKey: seed.opportunityTypeKey ?? null,
      salesInitiative: seed.salesInitiative ?? null,
      suggestedFee: seed.suggestedAnthemFee,
      dealType: seed.dealType ?? null,
    };
    const lane = classifyAutoSendLane(laneInput);
    assert.notEqual(lane, "other", `${seed.name} fell into 'other' lane instead of $15k+`);

    const skip = autoSendSkipReason(
      {
        ...laneInput,
        doNotProspect: false,
        existingClient: false,
        alreadyContacted: false,
        duplicateWarning: false,
        eventDate: seed.eventDateEstimate ?? null,
        totalScore: 82,
        audienceScore: 8,
        budgetScore: 8,
        email: primary.email,
        emailVerificationStatus: primary.emailVerificationStatus ?? "valid_format",
        personName: true,
        draftOpen: true,
        blockedEmail: false,
        queueKind: "initial",
        queueStatus: "pending",
      },
      "2026-11-17"
    );
    assert.equal(skip, null, `${seed.name} skipped by autosend: ${skip}`);
  }

  console.log(`ok: ${KEY_2027_PROSPECT_SEEDS.length} net-new 2027 $15k+ prospects verified for the lineup`);
}

main();
