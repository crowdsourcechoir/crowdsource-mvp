/**
 * Shared Seattle & Pacific Northwest sports priority classifier.
 *
 * Joel is building local partner teams first so Fan Chant and season-long
 * participatory game-day traditions launch close to home in Seattle and the
 * Pacific Northwest before expanding to out-of-region teams and national leads.
 *
 * Tiers (higher = higher priority in "To send" email drafts & Outreach Drafts):
 *   3 — Seattle / Puget Sound sports partner teams & athletics (Seattle, Tacoma, Everett, Renton, Tukwila, Kent, Federal Way, Bellevue, Kirkland)
 *   2 — Washington State sports partner teams & athletics (Spokane, Pullman, Tri-Cities/Kennewick, Wenatchee, Bellingham, Yakima, Walla Walla, Cheney, Olympia)
 *   1 — Greater Pacific Northwest sports partner teams & athletics (Oregon, Idaho, British Columbia / Portland, Eugene, Corvallis, Hillsboro, Boise, Vancouver BC)
 *   0 — Everything else (non-sports or outside the Pacific Northwest)
 */

import { classifyQueueCategory } from "./category";

export type PnwSportsPriorityTier = 0 | 1 | 2 | 3;

export type PnwSportsPriorityInput = {
  organizationName?: string | null;
  opportunityTitle?: string | null;
  category?: string | null;
  opportunityTypeKey?: string | null;
  organizationTypeKey?: string | null;
  salesInitiative?: string | null;
  productExperience?: string | null;
  locationCity?: string | null;
  locationRegion?: string | null;
  locationCountry?: string | null;
};

const SEATTLE_METRO_CITIES = new Set([
  "seattle",
  "tacoma",
  "everett",
  "renton",
  "tukwila",
  "kent",
  "bellevue",
  "kirkland",
  "redmond",
  "federal way",
  "lynnwood",
  "bothell",
  "shoreline",
  "puyallup",
  "bremerton",
]);

const WA_REGIONS = new Set(["wa", "washington"]);
const PNW_OUTER_REGIONS = new Set([
  "or",
  "oregon",
  "id",
  "idaho",
  "bc",
  "british columbia",
  "mt",
  "montana",
]);

const SEATTLE_METRO_SPORTS_NAME_RE =
  /\b(seattle\s+(?:mariners|seahawks|sounders|kraken|storm|reign|torrent|seawolves|orcas|thunderbirds|university|pacific)|climate\s+pledge\s+arena|ballard\s+fc|salmon\s+bay\s+fc|tacoma\s+(?:rainiers|defiance|stars)|everett\s+(?:silvertips|aquasox)|university\s+of\s+washington|washington\s+huskies|uw\s+(?:huskies|athletics)|husky\s+athletics|seattle\s+u\b|redhawks\s+athletics|junction\s+fc)\b/i;

const WA_SPORTS_NAME_RE =
  /\b(washington\s+state\s+(?:university|cougars|athletics)|wsu\s+(?:cougars|athletics)|spokane\s+(?:chiefs|indians|velocity|zephyr)|usl\s+spokane|tri-?city\s+(?:americans|dust\s+devils)|wenatchee\s+wild|bellingham\s+bells|yakima\s+valley\s+pippins|walla\s+walla\s+sweets|eastern\s+washington\s+(?:university|eagles|athletics)|ewu\s+athletics|western\s+washington\s+(?:university|vikings|athletics)|wwu\s+athletics|central\s+washington\s+(?:university|wildcats|athletics)|gonzaga\s+(?:university|bulldogs|athletics)|olympia\s+fc)\b/i;

const GREATER_PNW_SPORTS_NAME_RE =
  /\b(portland\s+(?:timbers|thorns|trail\s+blazers|winterhawks|pickles|bangaz|state)|university\s+of\s+portland|portland\s+pilots|portland\s+state\s+(?:vikings|athletics)|hillsboro\s+hops|eugene\s+emeralds|university\s+of\s+oregon|oregon\s+(?:ducks|athletics)|oregon\s+state\s+(?:university|beavers|athletics)|vancouver\s+(?:whitecaps|canucks|canadians|rise|goldeneyes|giants|warriors|bandits)|bc\s+lions|idaho\s+steelheads|boise\s+(?:hawks|state)|boise\s+state\s+(?:broncos|athletics)|university\s+of\s+idaho|idaho\s+vandals|montana\s+(?:grizzlies|state\s+bobcats))\b/i;

const EXPLICIT_SPORTS_TEAM_NAME_RE =
  /\b(mariners|seahawks|sounders|kraken|storm|reign\s+fc|seattle\s+torrent|seawolves|seattle\s+orcas|thunderbirds|silvertips|aquasox|rainiers|defiance|spokane\s+chiefs|spokane\s+indians|spokane\s+velocity|spokane\s+zephyr|usl\s+spokane|tri-?city\s+americans|dust\s+devils|wenatchee\s+wild|bellingham\s+bells|pippins|walla\s+walla\s+sweets|timbers|thorns|trail\s+blazers|winterhawks|portland\s+pickles|hillsboro\s+hops|eugene\s+emeralds|whitecaps|canucks|bc\s+lions|vancouver\s+canadians|vancouver\s+rise|goldeneyes|idaho\s+steelheads|boise\s+hawks|ballard\s+fc|salmon\s+bay\s+fc|\bathletics\b|\bfan\s+chant\b|\bchant\s+garden\b|\bgame-?day\b)\b/i;

const NON_TEAM_CORPORATE_SPONSOR_ORG_RE =
  /\b(convention\s+center|chamber\s+of\s+commerce|casino|hotel|marriott|hyatt|airlines?|bank\s+of|credit\s+union|hospital|health\s+plan|kaiser|amazon|microsoft|t-mobile|at&t|coca-cola|pepsi|deloitte|kpmg|pwc|ey\b|gensler)\b/i;

const NON_TEAM_SPONSOR_TITLE_RE = /\bfan\s+chant\s+sponsor\s*[—-]/i;

export function isSportsTeamOrAthleticsOpportunity(input: PnwSportsPriorityInput): boolean {
  const name = (input.organizationName ?? "").trim();
  const title = (input.opportunityTitle ?? "").trim();
  const combined = `${name} ${title}`;

  if (NON_TEAM_SPONSOR_TITLE_RE.test(title)) return false;
  if (NON_TEAM_CORPORATE_SPONSOR_ORG_RE.test(name) && !/\bclimate\s+pledge\s+arena\b/i.test(name)) {
    return false;
  }

  const orgType = (input.organizationTypeKey ?? "").trim().toLowerCase();
  const oppType = (input.opportunityTypeKey ?? "").trim().toLowerCase();
  const initiative = (input.salesInitiative ?? "").trim().toLowerCase();
  const product = (input.productExperience ?? "").trim().toLowerCase();

  if (orgType === "sports_team" || orgType === "sports_league") return true;
  if (oppType === "fan_engagement_initiative" || oppType === "team_season_launch") return true;
  if (initiative === "sports_fan_culture") return true;
  if (product === "fan_chant") return true;

  const cat =
    input.category && input.category.trim()
      ? input.category.trim().toLowerCase()
      : classifyQueueCategory({
          organizationName: input.organizationName,
          opportunityTitle: input.opportunityTitle,
          opportunityTypeKey: input.opportunityTypeKey,
          organizationTypeKey: input.organizationTypeKey,
          salesInitiative: input.salesInitiative,
        });

  if (cat === "sports") return true;
  return EXPLICIT_SPORTS_TEAM_NAME_RE.test(combined);
}

export function pnwSportsPriorityTier(input: PnwSportsPriorityInput): PnwSportsPriorityTier {
  if (!isSportsTeamOrAthleticsOpportunity(input)) return 0;

  const name = (input.organizationName ?? "").trim();
  const title = (input.opportunityTitle ?? "").trim();
  const combined = `${name} ${title}`;
  const city = (input.locationCity ?? "").trim().toLowerCase();
  const region = (input.locationRegion ?? "").trim().toLowerCase();

  if (SEATTLE_METRO_SPORTS_NAME_RE.test(combined)) return 3;
  if (WA_SPORTS_NAME_RE.test(combined)) return 2;
  if (GREATER_PNW_SPORTS_NAME_RE.test(combined)) return 1;

  if (city && SEATTLE_METRO_CITIES.has(city) && (!region || WA_REGIONS.has(region))) {
    return 3;
  }
  if (WA_REGIONS.has(region)) {
    return 2;
  }
  if (PNW_OUTER_REGIONS.has(region)) {
    return 1;
  }
  if (/\b(portland|eugene|corvallis|hillsboro|salem|bend|boise|coeur\s+d'alene|vancouver|victoria|kelowna)\b/i.test(city)) {
    return 1;
  }

  return 0;
}

export function isPnwSportsPriority(input: PnwSportsPriorityInput): boolean {
  return pnwSportsPriorityTier(input) > 0;
}

export function pnwSportsPriorityLabel(tier: PnwSportsPriorityTier): string | null {
  if (tier === 3) return "Seattle sports priority";
  if (tier === 2) return "WA sports priority";
  if (tier === 1) return "PNW sports priority";
  return null;
}
