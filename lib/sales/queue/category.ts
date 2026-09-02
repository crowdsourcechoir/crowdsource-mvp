/**
 * Queue filter buckets so sports, conferences, fundraisers, arts, and tech
 * don't sit in one undifferentiated list.
 *
 * Prefer opportunity / org type keys and optional import_metadata.salesInitiative.
 * Fall back to name/title heuristics so already-queued rows still filter.
 */

export const QUEUE_CATEGORY_KEYS = [
  "sports",
  "conferences",
  "fundraisers",
  "arts",
  "entertainment",
  "tech",
] as const;

export type QueueCategoryKey = (typeof QUEUE_CATEGORY_KEYS)[number];
export type QueueCategoryFilter = "all" | QueueCategoryKey;

export const QUEUE_CATEGORY_CHIPS: { key: QueueCategoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "sports", label: "Sports" },
  { key: "conferences", label: "Conferences" },
  { key: "fundraisers", label: "Fundraisers" },
  { key: "arts", label: "Arts" },
  { key: "entertainment", label: "Entertainment" },
  { key: "tech", label: "Tech" },
];

const INITIATIVE_TO_CATEGORY: Record<string, QueueCategoryKey> = {
  sports_fan_culture: "sports",
  conferences_associations: "conferences",
  fundraising_galas: "fundraisers",
  arts_culture: "arts",
  entertainment_media: "entertainment",
  tech_conferences: "tech",
};

export type QueueCategoryInput = {
  organizationName?: string | null;
  opportunityTitle?: string | null;
  opportunityTypeKey?: string | null;
  organizationTypeKey?: string | null;
  salesInitiative?: string | null;
};

function haystack(input: QueueCategoryInput): string {
  return [input.organizationName, input.opportunityTitle, input.opportunityTypeKey, input.organizationTypeKey]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function salesInitiativeOf(input: QueueCategoryInput): string | null {
  return input.salesInitiative?.trim() || null;
}

export function parseQueueCategory(value: string | null | undefined): QueueCategoryFilter {
  if (!value || value === "all") return "all";
  return (QUEUE_CATEGORY_KEYS as readonly string[]).includes(value) ? (value as QueueCategoryKey) : "all";
}

export function classifyQueueCategory(input: QueueCategoryInput): QueueCategoryKey {
  const initiative = salesInitiativeOf(input);
  if (initiative && INITIATIVE_TO_CATEGORY[initiative]) return INITIATIVE_TO_CATEGORY[initiative];

  const opp = (input.opportunityTypeKey ?? "").toLowerCase();
  const orgType = (input.organizationTypeKey ?? "").toLowerCase();
  const text = haystack(input);

  if (opp === "fundraising_gala" || /\bgala\b|fundrais|benefit dinner|charity ball/.test(text)) {
    return "fundraisers";
  }

  if (
    opp === "fan_engagement_initiative" ||
    opp === "team_season_launch" ||
    orgType === "sports_team" ||
    orgType === "sports_league" ||
    /\bathletics\b|\bseahawks\b|\bsounders\b|\bkraken\b|\bmariners\b|\bstorm\b|\bfan.?culture\b|\bgame-day\b|\bgameday\b/.test(
      text
    )
  ) {
    return "sports";
  }

  if (
    /\bethdenver\b|\bethereum\b|\bweb3\b|\bcrypto\b|\bhackathon\b|\bdevcon\b|\bpycon\b|\bkubecon\b|\baws re:invent\b|\bdeveloper conference\b|\bleaddev\b|\ball things open\b|\bethglobal\b|\bcloudflare\b|\bzendesk\b|\badobe summit\b|\bgoogle i\/o\b|\bmeta connect\b|\bwwdc\b|\bnvidia gtc\b|\bspace symposium\b|\bspacex\b|\bwaymo\b|\bdreamforce\b|\bcisco live\b|\bmobile world congress\b|\bvivatech\b/.test(
      text
    )
  ) {
    return "tech";
  }

  if (
    /\bnatas\b|\bnatpe\b|\bpromax\b|\brealscreen\b|\bemmy\b|\btelevision\b|\bstreaming\b|\bfilm festival\b|\bsundance\b|\btribeca\b|\bniva\b|\bvenue association\b|\bbroadway league\b|\brecording academy\b|\bmusic biz\b|\ba2im\b|\bpollstar\b|\blive nation\b|\bauto show\b|\bmotor show\b|\bsema\b|\bconcours\b|\bgoodwood\b|\bpebble beach\b|\bmeow wolf\b|\bsphere las vegas\b|\bcirque\b|\bcoachella\b|\btomorrowland\b|\bnamm\b|\biaapa\b/.test(
      text
    )
  ) {
    return "entertainment";
  }

  if (
    orgType === "festival" ||
    /\bwedgwood\b|\borchestra\b|\bphilharmonic\b|\bsymphony\b|\bopera\b|\bballet\b|\bchoir\b|\bchorus\b|\btheatre\b|\btheater\b|\bmuseum\b|\barts council\b|\bperforming arts\b|\bfilm independent\b|\bjazz\b|\bfolk alliance\b|\bamericana\b|\blincoln center\b|\bcarnegie hall\b|\bkexp\b|\bscience center\b|\bplanetarium\b|\bexploratorium\b|\bmaker faire\b|\bteamlab\b|\bartechouse\b|\bars electronica\b/.test(
      text
    )
  ) {
    return "arts";
  }

  if (opp === "annual_conference" || opp === "association_convention" || orgType === "conference" || orgType === "association") {
    return "conferences";
  }

  return "conferences";
}

export function matchesQueueCategory(
  input: QueueCategoryInput & { category?: string | null },
  filter: QueueCategoryFilter
): boolean {
  if (filter === "all") return true;
  if (input.category && (QUEUE_CATEGORY_KEYS as readonly string[]).includes(input.category)) {
    return input.category === filter;
  }
  return classifyQueueCategory(input) === filter;
}

export function countQueueCategories<T extends QueueCategoryInput>(
  items: T[]
): Record<QueueCategoryFilter, number> {
  const counts: Record<QueueCategoryFilter, number> = {
    all: items.length,
    sports: 0,
    conferences: 0,
    fundraisers: 0,
    arts: 0,
    entertainment: 0,
    tech: 0,
  };
  for (const item of items) {
    counts[classifyQueueCategory(item)] += 1;
  }
  return counts;
}

export function queueCategoryLabel(key: QueueCategoryFilter): string {
  return QUEUE_CATEGORY_CHIPS.find((c) => c.key === key)?.label ?? key;
}
