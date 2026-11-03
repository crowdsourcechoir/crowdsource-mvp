/**
 * Internal Anthem Experience pricing framework (November 2026).
 * One core experience; fee scales with event value — not extra deliverables.
 */

export const ANTHEM_MINIMUM_FEE = 7_500;

export type PricingCategory = "fundraiser" | "conference" | "corporate" | "other";

export type PricingConfidence = "high" | "medium" | "low";

export type SponsorshipPotential = "yes" | "no" | "unknown";

export type FundraiserTierKey =
  | "under_250k"
  | "250k_499k"
  | "500k_999k"
  | "1m_2_49m"
  | "2_5m_4_99m"
  | "5m_plus";

export type ConferenceTierKey =
  | "small_regional"
  | "mid_association"
  | "national"
  | "major_industry"
  | "flagship_global";

export type PricingTierKey = FundraiserTierKey | ConferenceTierKey | "corporate_default" | "review";

export const FUNDRAISER_TIERS: {
  key: FundraiserTierKey;
  label: string;
  minGoal: number;
  maxGoal: number | null;
  fee: number | null;
  openEnded?: boolean;
}[] = [
  { key: "under_250k", label: "Under $250k goal", minGoal: 0, maxGoal: 249_999, fee: 7_500 },
  { key: "250k_499k", label: "$250k–$499k goal", minGoal: 250_000, maxGoal: 499_999, fee: 10_000 },
  { key: "500k_999k", label: "$500k–$999k goal", minGoal: 500_000, maxGoal: 999_999, fee: 15_000 },
  { key: "1m_2_49m", label: "$1M–$2.49M goal", minGoal: 1_000_000, maxGoal: 2_499_999, fee: 20_000 },
  { key: "2_5m_4_99m", label: "$2.5M–$4.99M goal", minGoal: 2_500_000, maxGoal: 4_999_999, fee: 30_000 },
  { key: "5m_plus", label: "$5M+ goal", minGoal: 5_000_000, maxGoal: null, fee: 40_000, openEnded: true },
];

export const CONFERENCE_TIERS: {
  key: ConferenceTierKey;
  label: string;
  fee: number | null;
  openEnded?: boolean;
}[] = [
  { key: "small_regional", label: "Small / regional gathering", fee: 7_500 },
  { key: "mid_association", label: "Mid-sized association conference", fee: 10_000 },
  { key: "national", label: "Established national conference", fee: 15_000 },
  { key: "major_industry", label: "Major industry / corporate conference", fee: 25_000 },
  { key: "flagship_global", label: "Flagship / global gathering", fee: 40_000, openEnded: true },
];

export type PricingSignals = {
  organizationName?: string | null;
  opportunityTitle?: string | null;
  eventOrInitiativeName?: string | null;
  description?: string | null;
  opportunityTypeKey?: string | null;
  organizationTypeKey?: string | null;
  salesInitiative?: string | null;
  /** Verified or estimated event fundraising goal (USD). */
  fundraisingGoalUsd?: number | null;
  fundraisingGoalVerified?: boolean;
  /** Estimated attendance when known. */
  attendance?: number | null;
  attendanceVerified?: boolean;
  /** Free-text evidence snippets already in CRM / research (not invented). */
  evidenceSnippets?: string[];
  /** Operator notes / OCR / import notes. */
  operatorNotes?: string | null;
};

export type PricingRecommendation = {
  pricingCategory: PricingCategory;
  pricingTier: PricingTierKey;
  suggestedAnthemFee: number | null;
  pricingRationale: string;
  pricingConfidence: PricingConfidence;
  pricingEvidence: string[];
  pricingQuestions: string[];
  sponsorshipPotential: SponsorshipPotential;
};

function haystack(signals: PricingSignals): string {
  return [
    signals.organizationName,
    signals.opportunityTitle,
    signals.eventOrInitiativeName,
    signals.description,
    signals.opportunityTypeKey,
    signals.organizationTypeKey,
    signals.salesInitiative,
    signals.operatorNotes,
    ...(signals.evidenceSnippets ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Parse money like $1.2M, 500,000, 1M from trusted CRM/research text only. */
export function extractMoneyAmounts(text: string): number[] {
  const amounts: number[] = [];
  const re =
    /\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|m|mm|million|thousand)?\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const raw = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(raw)) continue;
    const unit = (match[2] ?? "").toLowerCase();
    let value = raw;
    if (unit === "k" || unit === "thousand") value = raw * 1_000;
    else if (unit === "m" || unit === "mm" || unit === "million") value = raw * 1_000_000;
    // Ignore tiny noise (years, scores) unless marked with $
    const hadDollar = match[0].includes("$");
    if (!hadDollar && value < 1_000) continue;
    if (value >= 1_000 && value <= 100_000_000) amounts.push(Math.round(value));
  }
  return amounts;
}

export function extractAttendance(text: string): number | null {
  const patterns = [
    /(\d{1,3}(?:,\d{3})+|\d+)\s*(?:\+|plus)?\s*(?:attendees|participants|guests|delegates|people in the room)/i,
    /attendance(?:\s+of|\s*:)?\s*(\d{1,3}(?:,\d{3})+|\d+)/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (!m) continue;
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 20 && n <= 200_000) return n;
  }
  return null;
}

export function classifyPricingCategory(signals: PricingSignals): PricingCategory {
  const opp = (signals.opportunityTypeKey ?? "").toLowerCase();
  const orgType = (signals.organizationTypeKey ?? "").toLowerCase();
  const initiative = (signals.salesInitiative ?? "").toLowerCase();
  const text = haystack(signals);

  if (
    opp === "fundraising_gala" ||
    initiative === "fundraising_galas" ||
    /\bgala\b|fundrais|benefit dinner|charity ball|auction|fund-a-need|paddle raise/.test(text)
  ) {
    return "fundraiser";
  }

  if (
    opp === "fan_engagement_initiative" ||
    opp === "team_season_launch" ||
    orgType === "sports_team" ||
    orgType === "sports_league" ||
    initiative === "sports_fan_culture" ||
    initiative === "wfea_network" ||
    /\bathletics\b|\bresidency\b|\bsong garden\b|\bpublic show\b|\bstadium\b|\bgame-?day\b/.test(text)
  ) {
    return "other";
  }

  if (
    opp === "employee_gathering" ||
    orgType === "corporation" ||
    /\bcorporate\b|\bleadership summit\b|\boffsite\b|\byear-?end (party|celebration|event)\b|\bcompany (retreat|all-?hands)\b/.test(
      text
    )
  ) {
    return "corporate";
  }

  if (
    opp === "annual_conference" ||
    opp === "association_convention" ||
    orgType === "conference" ||
    orgType === "association" ||
    initiative === "conferences_associations" ||
    initiative === "tech_conferences" ||
    /\bconference\b|\bsummit\b|\bconvention\b|\bsymposium\b|\bcongress\b/.test(text)
  ) {
    return "conference";
  }

  return "other";
}

export function fundraiserTierForGoal(goalUsd: number): (typeof FUNDRAISER_TIERS)[number] {
  for (const tier of FUNDRAISER_TIERS) {
    if (tier.maxGoal == null) {
      if (goalUsd >= tier.minGoal) return tier;
      continue;
    }
    if (goalUsd >= tier.minGoal && goalUsd <= tier.maxGoal) return tier;
  }
  return FUNDRAISER_TIERS[0];
}

export function classifyConferenceProfile(signals: PricingSignals): ConferenceTierKey {
  const text = haystack(signals);
  const attendance = signals.attendance ?? null;

  if (
    /\bflagship\b|\bglobal\b|\bworld congress\b|\binternational (conference|summit)\b|\bethdenver\b|\bethglobal\b|\bkubecon\b|\baws re:invent\b/.test(
      text
    )
  ) {
    return "flagship_global";
  }

  if (
    /\bmajor (industry|corporate)\b|\bFortune\b|\bleadership summit\b|\bcorporate conference\b/.test(text) ||
    (attendance != null && attendance >= 3_000)
  ) {
    return "major_industry";
  }

  if (
    /\bnational\b|\bannual conference\b|\bamplified?\b|\bnationwide\b/.test(text) ||
    (attendance != null && attendance >= 800)
  ) {
    return "national";
  }

  if (
    /\bassociation\b|\bmid-?sized\b|\bregional association\b/.test(text) ||
    (attendance != null && attendance >= 250)
  ) {
    return "mid_association";
  }

  if (/\bregional\b|\blocal\b|\bchapter\b|\bsmall\b/.test(text) || (attendance != null && attendance < 250)) {
    return "small_regional";
  }

  // Default when conference but profile unclear — national is the documented standard target.
  return "national";
}

function sponsorshipFromText(text: string): SponsorshipPotential {
  if (/\bsponsor(ship|ed|ing)?\b|\bunderwrit/.test(text)) return "yes";
  return "unknown";
}

/**
 * Recommend an internal Anthem Experience fee from CRM/research signals only.
 * Does not invent fundraising goals, budgets, or attendance.
 */
export function recommendAnthemPricing(signals: PricingSignals): PricingRecommendation {
  const category = classifyPricingCategory(signals);
  const text = haystack(signals);
  const evidence = [...(signals.evidenceSnippets ?? [])].filter(Boolean).slice(0, 8);
  const questions: string[] = [];
  const sponsorship = sponsorshipFromText(text);

  if (category === "other") {
    return {
      pricingCategory: "other",
      pricingTier: "review",
      suggestedAnthemFee: null,
      pricingRationale:
        "Not a fundraiser/conference/corporate gathering under the Anthem fee tables (e.g. sports, residency, festival network, or unclear). Needs individual scoping.",
      pricingConfidence: "low",
      pricingEvidence: evidence,
      pricingQuestions: [
        "Confirm whether this is an Anthem Experience sale vs partnership / owned / other product.",
        "If it is a paid Anthem, what is the gathering scale and commercial context?",
      ],
      sponsorshipPotential: sponsorship,
    };
  }

  if (category === "fundraiser") {
    let goal = signals.fundraisingGoalUsd ?? null;
    let goalVerified = Boolean(signals.fundraisingGoalVerified && goal != null);

    if (goal == null) {
      // Prefer amounts near fundraising language in evidence/description — still only from text.
      const goalHints = extractMoneyAmounts(
        [
          signals.description,
          signals.operatorNotes,
          ...(signals.evidenceSnippets ?? []),
        ]
          .filter(Boolean)
          .join(" ")
      ).filter((n) => n >= 50_000);
      if (goalHints.length === 1) {
        goal = goalHints[0];
        goalVerified = false;
        evidence.push(`Inferred event goal ~${goal.toLocaleString("en-US")} from CRM/research text (unverified).`);
      } else if (goalHints.length > 1) {
        questions.push(
          `Multiple dollar amounts found (${goalHints
            .slice(0, 4)
            .map((n) => `$${n.toLocaleString("en-US")}`)
            .join(", ")}). Confirm the event-specific fundraising goal.`
        );
      }
    }

    if (goal == null) {
      questions.push("What is the event-specific fundraising goal (not annual org revenue)?");
      questions.push("Approx attendance and donor profile?");
      return {
        pricingCategory: "fundraiser",
        pricingTier: "review",
        suggestedAnthemFee: null,
        pricingRationale:
          "Fundraising opportunity, but event goal is unknown — fee left empty per framework (do not substitute annual revenue).",
        pricingConfidence: "low",
        pricingEvidence: evidence,
        pricingQuestions: questions,
        sponsorshipPotential: sponsorship,
      };
    }

    const tier = fundraiserTierForGoal(goal);
    const fee = tier.openEnded ? null : tier.fee;
    if (tier.openEnded) {
      questions.push("Goal is $5M+ — evaluate individually above $40k; do not treat $40k as a ceiling.");
    }
    if (!goalVerified) {
      questions.push("Verify the event fundraising goal with the prospect or public materials.");
    }

    return {
      pricingCategory: "fundraiser",
      pricingTier: tier.key,
      suggestedAnthemFee: fee ?? 40_000,
      pricingRationale: `Fundraiser tier "${tier.label}" from event goal ~$${goal.toLocaleString("en-US")}.${
        tier.openEnded ? " Open-ended $40k+ band — confirm final fee." : ""
      }`,
      pricingConfidence: goalVerified ? "high" : "medium",
      pricingEvidence: evidence,
      pricingQuestions: questions,
      sponsorshipPotential: sponsorship,
    };
  }

  if (category === "corporate") {
    const attendance = signals.attendance ?? extractAttendance(text);
    const profile = classifyConferenceProfile({
      ...signals,
      attendance: attendance ?? signals.attendance,
    });
    // Corporate uses conference commercial-profile table with corporate label.
    const tier = CONFERENCE_TIERS.find((t) => t.key === profile) ?? CONFERENCE_TIERS[2];
    const fee = tier.openEnded ? 40_000 : tier.fee;
    if (attendance == null) questions.push("Estimated attendance?");
    questions.push("Overall event / programming budget if available?");
    return {
      pricingCategory: "corporate",
      pricingTier: tier.key,
      suggestedAnthemFee: fee,
      pricingRationale: `Corporate gathering classified as "${tier.label}" (commercial profile, not attendance alone).`,
      pricingConfidence: attendance != null ? "medium" : "low",
      pricingEvidence: evidence,
      pricingQuestions: questions,
      sponsorshipPotential: sponsorship,
    };
  }

  // conference
  const attendance =
    signals.attendance ?? extractAttendance([signals.description, ...(signals.evidenceSnippets ?? [])].join(" "));
  const profile = classifyConferenceProfile({ ...signals, attendance });
  const tier = CONFERENCE_TIERS.find((t) => t.key === profile)!;
  const fee = tier.fee;
  if (attendance == null) questions.push("Estimated attendance?");
  if (!/\bnational\b|\bglobal\b|\bregional\b|\bassociation\b/.test(text)) {
    questions.push("Confirm regional vs national vs flagship prominence.");
  }
  questions.push("Registration pricing / programming budget if known?");

  return {
    pricingCategory: "conference",
    pricingTier: tier.key,
    suggestedAnthemFee: fee,
    pricingRationale: `Conference profile "${tier.label}". Standard national target is $15,000 when profile is established national.`,
    pricingConfidence:
      profile === "national" && /\bnational\b|annual conference/.test(text)
        ? "medium"
        : attendance != null
          ? "medium"
          : "low",
    pricingEvidence: evidence,
    pricingQuestions: questions,
    sponsorshipPotential: sponsorship,
  };
}
