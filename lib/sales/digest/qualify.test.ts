import assert from "node:assert/strict";
import {
  dedupeDigestItemsByOrganization,
  filterDigestItemsByCategory,
  filterDigestQualifyingItems,
} from "./qualify";
import type { QueueItemDetail } from "../types";

function stubItem(overrides: {
  orgId: string;
  orgName: string;
  score: number;
  opportunityTypeKey?: string | null;
  organizationTypeKey?: string | null;
  salesInitiative?: string | null;
  title?: string;
}): QueueItemDetail {
  return {
    queueItem: {
      id: `qi_${overrides.orgId}`,
      opportunityId: `opp_${overrides.orgId}`,
      outreachDraftId: null,
      prospectScoreId: null,
      kind: "initial",
      duplicateWarning: false,
      status: "pending",
      decisionNotes: null,
      decidedBy: null,
      decidedAt: null,
      deferredUntil: null,
      createdAt: new Date().toISOString(),
    },
    opportunity: {
      id: `opp_${overrides.orgId}`,
      organizationId: overrides.orgId,
      opportunityTypeId: null,
      title: overrides.title ?? "Annual conference",
      eventOrInitiativeName: null,
      eventDateEstimate: null,
      eventDateConfidence: null,
      description: null,
      status: "identified",
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
    opportunityTypeKey: overrides.opportunityTypeKey ?? "annual_conference",
    organization: {
      id: overrides.orgId,
      name: overrides.orgName,
      normalizedName: overrides.orgName.toLowerCase(),
      domain: null,
      organizationTypeId: null,
      industrySegmentId: null,
      websiteUrl: null,
      locationCity: null,
      locationRegion: null,
      locationCountry: null,
      estimatedSize: null,
      source: "manual",
      duplicateOfOrganizationId: null,
      isExistingClient: false,
      importMetadata: overrides.salesInitiative ? { salesInitiative: overrides.salesInitiative } : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    organizationTypeLabel: null,
    organizationTypeKey: overrides.organizationTypeKey ?? "association",
    category: "conferences",
    contact: null,
    contacts: [],
    contactDrafts: [],
    score: {
      id: `sc_${overrides.orgId}`,
      opportunityId: `opp_${overrides.orgId}`,
      pipelineRunId: "pr_1",
      totalScore: overrides.score,
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

const conference = stubItem({
  orgId: "org_conf",
  orgName: "APA",
  score: 82,
  opportunityTypeKey: "annual_conference",
  organizationTypeKey: "association",
  salesInitiative: "conferences_associations",
});

const sports = stubItem({
  orgId: "org_sports",
  orgName: "Seahawks",
  score: 90,
  opportunityTypeKey: "fan_engagement_initiative",
  organizationTypeKey: "sports_team",
  salesInitiative: "sports_fan_culture",
  title: "Fan engagement",
});
sports.category = "sports";

const conferenceDup = stubItem({
  orgId: "org_conf",
  orgName: "APA",
  score: 71,
  opportunityTypeKey: "annual_conference",
  organizationTypeKey: "association",
  salesInitiative: "conferences_associations",
  title: "Second APA opportunity",
});

const low = stubItem({
  orgId: "org_low",
  orgName: "Low Conf",
  score: 40,
  opportunityTypeKey: "annual_conference",
  organizationTypeKey: "association",
});

assert.equal(filterDigestQualifyingItems([conference, sports, low], 70).length, 2);
assert.deepEqual(
  filterDigestItemsByCategory([conference, sports, low], "conferences").map((i) => i.organization.id),
  ["org_conf", "org_low"]
);
assert.deepEqual(
  dedupeDigestItemsByOrganization([conference, conferenceDup, sports]).map((i) => ({
    org: i.organization.id,
    score: i.score?.totalScore,
  })),
  [
    { org: "org_sports", score: 90 },
    { org: "org_conf", score: 82 },
  ]
);

console.log("digest qualify tests passed");
