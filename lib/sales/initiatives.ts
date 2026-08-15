/**
 * Lightweight sales initiatives so sports fan-culture work stays separate from
 * conference/association outreach in filters, digests, and queue mental model.
 *
 * Stored on organizations.import_metadata.salesInitiative (jsonb) — no migration required.
 */

export const SALES_INITIATIVES = {
  sports_fan_culture: {
    key: "sports_fan_culture",
    label: "Sports / fan culture",
    description:
      "Pro, pre-pro, and university athletics — belonging, game entertainment, marketing, fan engagement.",
    organizationTypeKeys: ["sports_team", "sports_league", "university"] as const,
    opportunityTypeKeys: ["fan_engagement_initiative", "team_season_launch"] as const,
    industrySegmentKey: "sports_entertainment",
  },
  conferences_associations: {
    key: "conferences_associations",
    label: "Conferences / associations",
    description: "Annual conferences, associations, leadership summits — participatory anthem for the theme.",
    organizationTypeKeys: ["conference", "association", "nonprofit"] as const,
    opportunityTypeKeys: ["annual_conference", "association_convention"] as const,
    industrySegmentKey: null,
  },
} as const;

export type SalesInitiativeKey = keyof typeof SALES_INITIATIVES;

export function isSalesInitiativeKey(value: unknown): value is SalesInitiativeKey {
  return typeof value === "string" && value in SALES_INITIATIVES;
}

export function readSalesInitiative(importMetadata: unknown): SalesInitiativeKey | null {
  if (!importMetadata || typeof importMetadata !== "object") return null;
  const key = (importMetadata as Record<string, unknown>).salesInitiative;
  return isSalesInitiativeKey(key) ? key : null;
}

export function withSalesInitiative(
  importMetadata: Record<string, unknown> | null | undefined,
  initiative: SalesInitiativeKey
): Record<string, unknown> {
  return { ...(importMetadata ?? {}), salesInitiative: initiative };
}

/** Seattle-region sports priority for enrichment / queue (names match CRM orgs when present). */
export const SEATTLE_SPORTS_PRIORITY: {
  name: string;
  tier: "pro" | "pre_pro" | "university";
  targetRoles: string[];
  notes: string;
}[] = [
  {
    name: "Seattle Seahawks",
    tier: "pro",
    targetRoles: ["Game Entertainment", "Entertainment Experience", "Marketing"],
    notes: "Active outreach in queue — send only with confirm; Gmail kill switch still off.",
  },
  {
    name: "Seattle Sounders FC",
    tier: "pro",
    targetRoles: ["Fan Engagement", "Events and Live Experience", "Brand Marketing", "VP Marketing"],
    notes: "Many named contacts in CRM; almost no emails — Hunter enrich Ashley Fosberg / Kimberly Aigner / Andre Elkins / Cole Parsons orbit.",
  },
  {
    name: "Seattle Kraken",
    tier: "pro",
    targetRoles: ["Marketing", "Fan Experience", "Game Presentation", "Partnership Marketing"],
    notes: "Placeholder contacts only — need real marketing/entertainment names + emails.",
  },
  {
    name: "Seattle Storm",
    tier: "pro",
    targetRoles: ["Marketing", "Fan Engagement", "Game Entertainment"],
    notes: "Mostly generic inboxes; find named marketing / experience leads.",
  },
  {
    name: "Seattle Mariners",
    tier: "pro",
    targetRoles: ["Marketing & Fan Engagement", "Game Entertainment", "Creative"],
    notes: "Not in CRM yet — add org + Mandy Sundblad orbit via Hunter.",
  },
  {
    name: "Seattle Reign FC",
    tier: "pro",
    targetRoles: ["Marketing", "Fan Engagement"],
    notes: "Not in CRM yet — often shares staff orbit with Sounders.",
  },
  {
    name: "Tacoma Rainiers",
    tier: "pre_pro",
    targetRoles: ["VP Marketing", "Event Operations and Experience"],
    notes: "Names present; emails invalid placeholders — re-find via Hunter.",
  },
  {
    name: "Portland Pickles",
    tier: "pre_pro",
    targetRoles: ["Partnerships", "Marketing", "GM"],
    notes: "One valid email (Tyler Nelson) — use carefully; not Seattle but regional.",
  },
  {
    name: "University of Washington Athletics",
    tier: "university",
    targetRoles: ["Marketing & Fan Engagement", "Brand & External Strategy", "Engagement"],
    notes: "Strong named list with emails — top university priority after Seahawks.",
  },
  {
    name: "Washington State University Athletics",
    tier: "university",
    targetRoles: ["Marketing and Fan Experience", "Brand / Promotions"],
    notes: "Emails present — good second university wave.",
  },
  {
    name: "Gonzaga University Athletics",
    tier: "university",
    targetRoles: ["Revenue Generation", "Marketing", "COO Athletics"],
    notes: "Many emails — Spokane but strong brand; keep in sports initiative.",
  },
  {
    name: "Seattle University Athletics",
    tier: "university",
    targetRoles: ["Marketing and Fan Experience"],
    notes: "Andres Gonzalez email present.",
  },
  {
    name: "Seattle Pacific University Athletics",
    tier: "university",
    targetRoles: ["Athletic Director", "Marketing"],
    notes: "Thin contacts — enrich marketing seat.",
  },
  {
    name: "Western Washington University Athletics",
    tier: "university",
    targetRoles: ["Community Engagement", "Marketing"],
    notes: "One engagement email — expand.",
  },
];
