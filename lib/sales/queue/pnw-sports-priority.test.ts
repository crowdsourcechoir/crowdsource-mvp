import assert from "node:assert/strict";
import { isGenericMailboxEmail } from "@/lib/sales/dedupe";
import { pnwSportsPriorityTier } from "@/lib/sales/queue/pnw-sports-priority";
import { sortQueueSidebarItems } from "@/lib/sales/queue/sidebar";
import { PNW_SPORTS_PARTNER_TEAMS, buildPnwSportsPartnerDraft } from "@/lib/sales/seed/pnw-sports-teams";
import type { Contact, QueueSidebarItem } from "@/lib/sales/types";

function mockSidebarItem(overrides: Partial<QueueSidebarItem> & { id: string; organizationName: string }): QueueSidebarItem {
  return {
    queueItem: {
      id: overrides.id,
      opportunityId: `opp-${overrides.id}`,
      outreachDraftId: `draft-${overrides.id}`,
      prospectScoreId: `score-${overrides.id}`,
      kind: "initial",
      duplicateWarning: false,
      status: "pending",
      decisionNotes: null,
      decidedBy: null,
      decidedAt: null,
      deferredUntil: null,
      lastDigestedAt: null,
      createdAt: "2026-11-19T00:00:00.000Z",
    },
    organizationId: `org-${overrides.id}`,
    organizationName: overrides.organizationName,
    opportunityId: `opp-${overrides.id}`,
    opportunityTitle: overrides.opportunityTitle ?? "Opportunity",
    totalScore: overrides.totalScore ?? 82,
    draftConfidence: 0.7,
    category: overrides.category ?? "conferences",
    opportunityTypeKey: overrides.opportunityTypeKey ?? "annual_conference",
    organizationTypeKey: overrides.organizationTypeKey ?? "conference",
    recentlyAddedAt: "2026-11-19T00:00:00.000Z",
    outreachKind: overrides.outreachKind ?? "none",
    nextFollowUpAt: null,
    gmailThreadId: null,
    followUpDue: false,
    relationshipStage: null,
    eventDateEstimate: overrides.eventDateEstimate ?? null,
    revenueEngine: "premium",
    flagshipOffer: "anthem_experience",
    potentialAmount: 20_000,
    workstream: "premium",
    businessCategory: "commissioned",
    productExperience: overrides.productExperience ?? "anthem",
    dealType: "client_booking",
    editionBloom: null,
    qualificationScore: 2,
    locationCity: overrides.locationCity ?? null,
    locationRegion: overrides.locationRegion ?? null,
    pnwSportsPriorityTier: overrides.pnwSportsPriorityTier,
  };
}

function main() {
  // 1. Tier classification
  assert.equal(
    pnwSportsPriorityTier({
      organizationName: "Seattle Sounders FC",
      opportunityTitle: "Fan Chant — Seattle Sounders FC",
      organizationTypeKey: "sports_team",
      locationCity: "Seattle",
      locationRegion: "WA",
    }),
    3
  );
  assert.equal(
    pnwSportsPriorityTier({
      organizationName: "Tacoma Rainiers",
      opportunityTitle: "Fan Chant — Tacoma Rainiers",
      organizationTypeKey: "sports_team",
      locationCity: "Tacoma",
      locationRegion: "WA",
    }),
    3
  );
  assert.equal(
    pnwSportsPriorityTier({
      organizationName: "Spokane Chiefs",
      opportunityTitle: "Fan Chant — Spokane Chiefs",
      organizationTypeKey: "sports_team",
      locationCity: "Spokane",
      locationRegion: "WA",
    }),
    2
  );
  assert.equal(
    pnwSportsPriorityTier({
      organizationName: "Portland Thorns FC",
      opportunityTitle: "Fan Chant — Portland Thorns FC",
      organizationTypeKey: "sports_team",
      locationCity: "Portland",
      locationRegion: "OR",
    }),
    1
  );
  assert.equal(
    pnwSportsPriorityTier({
      organizationName: "Vancouver Whitecaps FC",
      opportunityTitle: "Fan Chant — Vancouver Whitecaps FC",
      organizationTypeKey: "sports_team",
      locationCity: "Vancouver",
      locationRegion: "BC",
    }),
    1
  );
  // Out-of-region sports teams and non-sports Seattle leads stay tier 0
  assert.equal(
    pnwSportsPriorityTier({
      organizationName: "Boston College Athletics",
      opportunityTitle: "Fan Chant",
      organizationTypeKey: "university",
      category: "sports",
      locationCity: "Chestnut Hill",
      locationRegion: "MA",
    }),
    0
  );
  assert.equal(
    pnwSportsPriorityTier({
      organizationName: "Amazon",
      opportunityTitle: "Fan Chant sponsor — Amazon",
      organizationTypeKey: "corporation",
      category: "sponsors",
      locationCity: "Seattle",
      locationRegion: "WA",
    }),
    0
  );
  assert.equal(
    pnwSportsPriorityTier({
      organizationName: "Breakthrough T1D Gala",
      opportunityTitle: "2027 Gala",
      organizationTypeKey: "nonprofit",
      category: "fundraisers",
      locationCity: "Seattle",
      locationRegion: "WA",
    }),
    0
  );

  // 2. Sidebar sorting puts Seattle sports -> WA sports -> OR/ID/BC sports -> national high-score items
  const items = [
    mockSidebarItem({
      id: "nat",
      organizationName: "Figma Config",
      totalScore: 95,
      category: "tech",
    }),
    mockSidebarItem({
      id: "or-sports",
      organizationName: "Portland Thorns FC",
      opportunityTitle: "Fan Chant — Portland Thorns FC",
      totalScore: 88,
      category: "sports",
      organizationTypeKey: "sports_team",
      productExperience: "fan_chant",
      locationCity: "Portland",
      locationRegion: "OR",
    }),
    mockSidebarItem({
      id: "wa-sports",
      organizationName: "USL Spokane (Spokane Velocity FC & Spokane Zephyr FC)",
      opportunityTitle: "Fan Chant — USL Spokane",
      totalScore: 87,
      category: "sports",
      organizationTypeKey: "sports_team",
      productExperience: "fan_chant",
      locationCity: "Spokane",
      locationRegion: "WA",
    }),
    mockSidebarItem({
      id: "sea-sports",
      organizationName: "Seattle Sounders FC",
      opportunityTitle: "Fan Chant — Seattle Sounders FC",
      totalScore: 91,
      category: "sports",
      organizationTypeKey: "sports_team",
      productExperience: "fan_chant",
      locationCity: "Seattle",
      locationRegion: "WA",
    }),
  ];
  const sorted = sortQueueSidebarItems(items);
  assert.deepEqual(
    sorted.map((s) => s.queueItem.id),
    ["sea-sports", "wa-sports", "or-sports", "nat"]
  );

  // 3. Validate all seeded PNW sports partner teams & drafts
  assert.ok(PNW_SPORTS_PARTNER_TEAMS.length >= 25, "Expected at least 25 PNW sports partner teams");
  const seenEmails = new Set<string>();
  for (const spec of PNW_SPORTS_PARTNER_TEAMS) {
    // Must not re-seed Ballard FC or Gonzaga or Oregon State
    assert.ok(!/ballard\s+fc|gonzaga|oregon\s+state/i.test(spec.organizationName), `Excluded org found: ${spec.organizationName}`);
    const tier = pnwSportsPriorityTier({
      organizationName: spec.organizationName,
      opportunityTitle: spec.opportunityTitle,
      organizationTypeKey: spec.organizationTypeKey,
      salesInitiative: "sports_fan_culture",
      productExperience: "fan_chant",
      locationCity: spec.locationCity,
      locationRegion: spec.locationRegion,
    });
    assert.ok(tier >= 1, `Expected positive PNW sports tier for ${spec.organizationName}, got ${tier}`);
    assert.ok(spec.contacts.length >= 1, `Expected contacts for ${spec.organizationName}`);

    for (const c of spec.contacts) {
      const emailLower = c.email.toLowerCase();
      assert.equal(isGenericMailboxEmail(emailLower), false, `Generic inbox on ${spec.organizationName}: ${c.email}`);
      assert.equal(seenEmails.has(emailLower), false, `Duplicate email across PNW sports seed: ${c.email}`);
      seenEmails.add(emailLower);

      const mockContact: Contact = {
        id: "c1",
        organizationId: "o1",
        fullName: c.fullName,
        roleTitle: c.roleTitle,
        roleCategory: c.roleCategory,
        outreachPersona: "events_director",
        email: c.email,
        normalizedEmail: emailLower,
        phone: null,
        emailVerificationStatus: c.emailVerificationStatus,
        linkedinUrl: null,
        source: "ai_discovered",
        duplicateOfContactId: null,
        importMetadata: null,
        enrichmentAttemptedAt: null,
        enrichmentProvider: "hunter",
        enrichmentStatus: "found",
        createdAt: "2026-11-19T00:00:00.000Z",
        updatedAt: "2026-11-19T00:00:00.000Z",
      };
      const draft = buildPnwSportsPartnerDraft(spec, mockContact);
      assert.ok(draft.subject.length > 5);
      assert.ok(draft.body.length > 80);
      assert.equal(draft.body.includes("/book"), false, `Draft for ${spec.organizationName} must not contain /book`);
    }
  }

  console.log("pnw sports priority & seed tests passed");
}

main();
