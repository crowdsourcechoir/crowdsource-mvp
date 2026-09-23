import assert from "node:assert/strict";
import { MAX_DIGEST_CONTACTS_PER_ORG, pickDigestContacts, renderDigestEmail } from "./render";
import type { Contact, QueueItemDetail } from "../types";

function contact(partial: Partial<Contact> & { id: string; fullName: string }): Contact {
  return {
    organizationId: "org_1",
    email: `${partial.id}@example.com`,
    normalizedEmail: `${partial.id}@example.com`,
    emailVerificationStatus: "valid_format",
    roleTitle: "Coordinator",
    roleCategory: null,
    outreachPersona: "other",
    phone: null,
    linkedinUrl: null,
    source: "manual",
    duplicateOfContactId: null,
    importMetadata: null,
    enrichmentAttemptedAt: null,
    enrichmentProvider: null,
    enrichmentStatus: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

function stubItem(contacts: Contact[]): QueueItemDetail {
  return {
    queueItem: {
      id: "qi_1",
      opportunityId: "opp_1",
      outreachDraftId: null,
      prospectScoreId: null,
      kind: "initial",
      duplicateWarning: false,
      status: "pending",
      decisionNotes: null,
      decidedBy: null,
      decidedAt: null,
      deferredUntil: null,
      lastDigestedAt: null,
      createdAt: new Date().toISOString(),
    },
    opportunity: {
      id: "opp_1",
      organizationId: "org_1",
      opportunityTypeId: null,
      title: "Annual conference anthem",
      eventOrInitiativeName: null,
      eventDateEstimate: null,
      eventDateConfidence: null,
      description: null,
      status: "researching",
      targetContactRoleHint: null,
      relationshipStage: null,
      stageUpdatedAt: null,
      gmailThreadId: null,
      lastOutboundAt: null,
      lastInboundAt: null,
      nextFollowUpAt: null,
      importMetadata: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    opportunityTypeLabel: "Annual conference",
    opportunityTypeKey: "annual_conference",
    organization: {
      id: "org_1",
      name: "Example Association",
      normalizedName: "example association",
      domain: "example.org",
      organizationTypeId: null,
      industrySegmentId: null,
      websiteUrl: "https://example.org",
      locationCity: null,
      locationRegion: null,
      locationCountry: null,
      estimatedSize: null,
      source: "manual",
      duplicateOfOrganizationId: null,
      isExistingClient: false,
      importMetadata: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    organizationTypeLabel: "Association",
    organizationTypeKey: "association",
    category: "conferences",
    contact: contacts[0] ?? null,
    contacts,
    contactDrafts: [],
    score: {
      id: "sc_1",
      opportunityId: "opp_1",
      pipelineRunId: "pr_1",
      totalScore: 81.5,
      componentScores: {} as QueueItemDetail["score"] extends infer S
        ? S extends { componentScores: infer C }
          ? C
          : never
        : never,
      rationale: "",
      confidence: "medium",
      missingInformation: [],
      model: null,
      createdAt: new Date().toISOString(),
    },
    brief: null,
    draft: null,
    findings: [],
    contactOutreach: {},
  };
}

const many = [
  contact({ id: "c1", fullName: "Alex Director", roleTitle: "Director of Events" }),
  contact({ id: "c2", fullName: "Blake Manager", roleTitle: "Conference Manager" }),
  contact({ id: "c3", fullName: "Casey Specialist", roleTitle: "Events Specialist" }),
  contact({ id: "c4", fullName: "Dana Extra", roleTitle: "Intern", email: null, normalizedEmail: null }),
];

const picked = pickDigestContacts(stubItem(many));
assert.equal(MAX_DIGEST_CONTACTS_PER_ORG, 3);
assert.equal(picked.length, 3);
assert.equal(picked[0]?.id, "c1");
assert.deepEqual(
  picked.map((c) => c.id),
  ["c1", "c2", "c3"],
  "must keep top 3 with email and drop the 4th"
);

const rendered = renderDigestEmail(
  [stubItem(many)],
  { newCount: 1, backlogCount: 10, sinceIso: new Date().toISOString(), minScore: 70, category: "conferences" },
  "https://app.crowdsourcechoir.com"
);
assert.match(rendered.text, /Contact 1:/);
assert.match(rendered.text, /Contact 2:/);
assert.match(rendered.text, /Contact 3:/);
assert.equal(/Contact 4:/.test(rendered.text), false);
assert.match(rendered.html, /Contact 1:/);
assert.match(rendered.html, /Contact 3:/);

console.log("digest render top-3 contacts tests passed");
