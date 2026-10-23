/**
 * Crowdsource Choir revenue playbook — Oct 2026.
 * Source: crowdsource_choir_revenue_strategy.pdf
 *
 * Encodes effort mix and category pipelines so Sales can *direct* work,
 * not only display targets.
 */

import type { RevenueEngineKey } from "../engines";
import type { QueueCategoryKey } from "../queue/category";
import type { SalesInitiativeKey } from "../initiatives";

/** 90-day time allocation from the playbook. */
export const WORKSTREAMS = {
  premium: {
    key: "premium",
    label: "Premium pipeline",
    shortLabel: "Premium",
    effortPct: 55,
    engine: "premium" as RevenueEngineKey,
    annualTargetUsd: 300_000,
    dealMath: "20 × $15K or 15 × $20K",
    buyers: "Conferences, association meetings, corporate summits, galas",
    action: "Pitch event owners + producers; proposals, 50% deposits",
    targets: ["NAIS follow-on", "APA NPC", "SHRM", "NAFSA", "nonprofit fundraisers"],
  },
  partnership: {
    key: "partnership",
    label: "Season partnerships",
    shortLabel: "Partnerships",
    effortPct: 20,
    engine: "partnership" as RevenueEngineKey,
    annualTargetUsd: 150_000,
    dealMath: "3 × $50K or 5 × $30K",
    buyers: "Sports teams, universities, alumni / fan programs",
    action: "Sell a season plan: chant pipeline + recurring activations",
    targets: ["Ballard FC", "Gonzaga", "Seattle pro / college teams"],
  },
  sponsor: {
    key: "sponsor",
    label: "Sponsor / distribution",
    shortLabel: "Sponsors",
    effortPct: 15,
    engine: null,
    annualTargetUsd: 60_000,
    dealMath: "Distribution + residency sponsors",
    buyers: "Agencies, producers, WFEA network, aligned sponsors",
    action: "Build referral partners; secure sponsor/guarantee before a run",
    targets: ["WFEA network", "gala producers", "DMCs"],
  },
  owned: {
    key: "owned",
    label: "Owned-show economics",
    shortLabel: "Owned",
    effortPct: 10,
    engine: "owned" as RevenueEngineKey,
    annualTargetUsd: 120_000,
    dealMath: "Residencies + ticketed shows (validate net)",
    buyers: "Venues, festivals, community audiences, presenters",
    action: "Track contribution; pilot without expensive venue lock-in",
    targets: ["Thriller Night", "holiday shows", "Seattle / Boise venues"],
  },
} as const;

export type WorkstreamKey = keyof typeof WORKSTREAMS;
export const WORKSTREAM_KEYS = Object.keys(WORKSTREAMS) as WorkstreamKey[];

export const PLAYBOOK = {
  title: "Revenue playbook",
  framing: "Paid bookings first; repeatable partnerships second",
  monthlyTargetsUsd: { survival: 15_000, healthy: 30_000, end2027: 50_000 },
  annualScenarioUsd: 600_000,
  bookingRule:
    "No unpaid exposure engagements. Reserve dates with a signed agreement and 50% deposit.",
  operatingRule:
    "Prioritize qualified buyers with budget, a decision-maker, a date, and a clear next step.",
  weeklyScorecard:
    "Track by category: named prospects → conversations → qualified → proposals → signed → deposits. Review expected close date, deal value, next action and weighted pipeline every Friday.",
} as const;

const INITIATIVE_TO_WORKSTREAM: Partial<Record<SalesInitiativeKey, WorkstreamKey>> = {
  sports_fan_culture: "partnership",
  conferences_associations: "premium",
  fundraising_galas: "premium",
  arts_culture: "owned",
  entertainment_media: "owned",
  tech_conferences: "premium",
};

const CATEGORY_TO_WORKSTREAM: Record<QueueCategoryKey, WorkstreamKey> = {
  sports: "partnership",
  conferences: "premium",
  fundraisers: "premium",
  arts: "owned",
  entertainment: "owned",
  tech: "premium",
};

export type WorkstreamClassifyInput = {
  revenueEngine?: string | null;
  flagshipOffer?: string | null;
  salesInitiative?: string | null;
  category?: string | null;
  organizationTypeKey?: string | null;
};

export function classifyWorkstream(input: WorkstreamClassifyInput): WorkstreamKey {
  const engine = input.revenueEngine;
  if (engine === "premium") return "premium";
  if (engine === "partnership") return "partnership";
  if (engine === "owned") return "owned";

  const offer = input.flagshipOffer;
  if (offer === "anthem_experience") return "premium";
  if (offer === "crowdsource_partnership") return "partnership";
  if (offer === "song_garden") return "owned";

  const orgType = (input.organizationTypeKey ?? "").toLowerCase();
  if (orgType === "event_agency" || orgType === "agency") return "sponsor";

  const initiative = input.salesInitiative as SalesInitiativeKey | null | undefined;
  if (initiative && INITIATIVE_TO_WORKSTREAM[initiative]) {
    return INITIATIVE_TO_WORKSTREAM[initiative]!;
  }

  const category = input.category as QueueCategoryKey | null | undefined;
  if (category && category in CATEGORY_TO_WORKSTREAM) {
    return CATEGORY_TO_WORKSTREAM[category];
  }

  return "premium";
}

/** Higher = work first when Focus mode mixes workstreams. */
export function workstreamPriority(key: WorkstreamKey): number {
  return WORKSTREAMS[key].effortPct;
}

export type QualificationSignals = {
  hasDecisionMaker: boolean;
  hasEventDate: boolean;
  hasPotentialAmount: boolean;
  hasNextStep: boolean;
};

export function qualificationScore(signals: QualificationSignals): number {
  return (
    (signals.hasDecisionMaker ? 1 : 0) +
    (signals.hasEventDate ? 1 : 0) +
    (signals.hasPotentialAmount ? 1 : 0) +
    (signals.hasNextStep ? 1 : 0)
  );
}

export function isQualifiedBuyer(signals: QualificationSignals): boolean {
  return qualificationScore(signals) >= 3;
}
