/**
 * Simplified sales taxonomy: two business categories, products, deal types.
 *
 * Stored on opportunities.import_metadata (optional overrides). When unset,
 * values are derived from existing revenueEngine / flagshipOffer / initiative /
 * category / org type — so every historical record maps without a migration.
 *
 * Distinct from opportunity_types (event shape: annual_conference, gala, …).
 * "Opportunity Type" in the product sense here is dealType (how the deal is structured).
 */

import type { FlagshipOfferKey, RevenueEngineKey } from "./engines";
import type { SalesInitiativeKey } from "./initiatives";
import type { QueueCategoryKey } from "./queue/category";
import type { WorkstreamKey } from "./strategy/playbook";

export const BUSINESS_CATEGORIES = {
  commissioned: {
    key: "commissioned",
    label: "Commissioned Experiences",
    shortLabel: "Commissioned",
    description: "Anthem, Fan Chant, Song Garden, and custom activations for a commissioning client.",
  },
  owned: {
    key: "owned",
    label: "Owned Entertainment",
    shortLabel: "Owned",
    description: "Rave Choir, themed editions, and other Crowdsource-owned Blooms.",
  },
} as const;

export type BusinessCategoryKey = keyof typeof BUSINESS_CATEGORIES;
export const BUSINESS_CATEGORY_KEYS = Object.keys(BUSINESS_CATEGORIES) as BusinessCategoryKey[];

export const PRODUCTS = {
  anthem: {
    key: "anthem",
    label: "Anthem",
    businessCategory: "commissioned" as const,
    flagshipOffer: "anthem_experience" as FlagshipOfferKey,
  },
  fan_chant: {
    key: "fan_chant",
    label: "Fan Chant",
    businessCategory: "commissioned" as const,
    flagshipOffer: "crowdsource_partnership" as FlagshipOfferKey,
  },
  song_garden: {
    key: "song_garden",
    label: "Song Garden",
    businessCategory: "commissioned" as const,
    flagshipOffer: "song_garden" as FlagshipOfferKey,
  },
  custom_activation: {
    key: "custom_activation",
    label: "Custom Activation",
    businessCategory: "commissioned" as const,
    flagshipOffer: null,
  },
  rave_choir: {
    key: "rave_choir",
    label: "Rave Choir",
    businessCategory: "owned" as const,
    flagshipOffer: null,
  },
  other_bloom: {
    key: "other_bloom",
    label: "Other Bloom",
    businessCategory: "owned" as const,
    flagshipOffer: null,
  },
} as const;

export type ProductExperienceKey = keyof typeof PRODUCTS;
export const PRODUCT_KEYS = Object.keys(PRODUCTS) as ProductExperienceKey[];

/** Deal structure — labeled “Opportunity Type” in the queue UI. */
export const DEAL_TYPES = {
  client_booking: {
    key: "client_booking",
    label: "Client Booking",
    shortLabel: "Booking",
  },
  sponsorship: {
    key: "sponsorship",
    label: "Sponsorship",
    shortLabel: "Sponsor",
  },
  strategic_partnership: {
    key: "strategic_partnership",
    label: "Strategic Partnership",
    shortLabel: "Strategic",
  },
  venue_partnership: {
    key: "venue_partnership",
    label: "Venue Partnership",
    shortLabel: "Venue",
  },
  production_partnership: {
    key: "production_partnership",
    label: "Production Partnership",
    shortLabel: "Production",
  },
} as const;

export type DealTypeKey = keyof typeof DEAL_TYPES;
export const DEAL_TYPE_KEYS = Object.keys(DEAL_TYPES) as DealTypeKey[];

export const HIGH_VALUE_POTENTIAL_USD = 15_000;

function asMetadata(importMetadata: unknown): Record<string, unknown> | null {
  if (!importMetadata || typeof importMetadata !== "object") return null;
  return importMetadata as Record<string, unknown>;
}

export function isBusinessCategoryKey(value: unknown): value is BusinessCategoryKey {
  return typeof value === "string" && value in BUSINESS_CATEGORIES;
}

export function isProductExperienceKey(value: unknown): value is ProductExperienceKey {
  return typeof value === "string" && value in PRODUCTS;
}

export function isDealTypeKey(value: unknown): value is DealTypeKey {
  return typeof value === "string" && value in DEAL_TYPES;
}

export function readBusinessCategory(importMetadata: unknown): BusinessCategoryKey | null {
  const meta = asMetadata(importMetadata);
  if (!meta) return null;
  return isBusinessCategoryKey(meta.businessCategory) ? meta.businessCategory : null;
}

export function readProductExperience(importMetadata: unknown): ProductExperienceKey | null {
  const meta = asMetadata(importMetadata);
  if (!meta) return null;
  return isProductExperienceKey(meta.productExperience) ? meta.productExperience : null;
}

export function readDealType(importMetadata: unknown): DealTypeKey | null {
  const meta = asMetadata(importMetadata);
  if (!meta) return null;
  return isDealTypeKey(meta.dealType) ? meta.dealType : null;
}

export function readEditionBloom(importMetadata: unknown): string | null {
  const meta = asMetadata(importMetadata);
  if (!meta) return null;
  const raw = meta.editionBloom;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 200) : null;
}

export type BusinessModelClassifyInput = {
  businessCategory?: string | null;
  productExperience?: string | null;
  dealType?: string | null;
  editionBloom?: string | null;
  revenueEngine?: string | null;
  flagshipOffer?: string | null;
  salesInitiative?: string | null;
  category?: string | null;
  organizationTypeKey?: string | null;
  workstream?: string | null;
  opportunityTitle?: string | null;
};

const OFFER_TO_PRODUCT: Record<FlagshipOfferKey, ProductExperienceKey> = {
  anthem_experience: "anthem",
  crowdsource_partnership: "fan_chant",
  song_garden: "song_garden",
};

/**
 * Derive product from existing portfolio / lane signals when no override is set.
 * Preserves meaning of historical Anthem / partnership / Song Garden tags.
 */
export function classifyProductExperience(input: BusinessModelClassifyInput): ProductExperienceKey {
  if (isProductExperienceKey(input.productExperience)) return input.productExperience;

  const offer = input.flagshipOffer as FlagshipOfferKey | null | undefined;
  if (offer && OFFER_TO_PRODUCT[offer]) return OFFER_TO_PRODUCT[offer];

  const title = (input.opportunityTitle ?? "").toLowerCase();
  if (/rave\s*choir|thriller|holiday\s*(rave|party)|halloween/.test(title)) {
    return /rave\s*choir|holiday/.test(title) ? "rave_choir" : "other_bloom";
  }
  if (/fan\s*chant|chant/.test(title)) return "fan_chant";
  if (/song\s*garden/.test(title)) return "song_garden";
  if (/anthem/.test(title)) return "anthem";

  const initiative = input.salesInitiative as SalesInitiativeKey | null | undefined;
  if (initiative === "sports_fan_culture") return "fan_chant";
  if (initiative === "booking_agents" || initiative === "sponsor_partners") return "custom_activation";
  if (initiative === "arts_culture" || initiative === "entertainment_media") return "rave_choir";

  const category = input.category as QueueCategoryKey | null | undefined;
  if (category === "sports") return "fan_chant";
  if (category === "booking_agents" || category === "sponsors") return "custom_activation";
  if (category === "arts" || category === "entertainment") return "rave_choir";

  if (input.revenueEngine === "owned" || input.workstream === "owned") return "rave_choir";
  if (input.revenueEngine === "partnership" || input.workstream === "partnership") return "fan_chant";

  return "anthem";
}

export function classifyBusinessCategory(input: BusinessModelClassifyInput): BusinessCategoryKey {
  if (isBusinessCategoryKey(input.businessCategory)) return input.businessCategory;

  const product = classifyProductExperience(input);
  return PRODUCTS[product].businessCategory;
}

export function classifyDealType(input: BusinessModelClassifyInput): DealTypeKey {
  if (isDealTypeKey(input.dealType)) return input.dealType;

  const initiative = input.salesInitiative as SalesInitiativeKey | null | undefined;
  if (initiative === "sponsor_partners") return "sponsorship";
  if (initiative === "sports_fan_culture") return "strategic_partnership";
  if (initiative === "booking_agents") return "production_partnership";
  if (initiative === "wfea_network") return "strategic_partnership";

  const category = input.category as QueueCategoryKey | null | undefined;
  if (category === "sponsors") return "sponsorship";
  if (category === "sports") return "strategic_partnership";
  if (category === "booking_agents") return "production_partnership";

  const orgType = (input.organizationTypeKey ?? "").toLowerCase();
  if (orgType === "venue") return "venue_partnership";
  if (orgType === "event_agency" || orgType === "destination_marketing_organization") {
    return "production_partnership";
  }
  if (orgType === "sports_team" || orgType === "sports_league" || orgType === "university") {
    return "strategic_partnership";
  }

  if (input.workstream === "sponsor") return "sponsorship";
  if (input.workstream === "partnership") return "strategic_partnership";
  if (input.workstream === "owned") return "venue_partnership";

  return "client_booking";
}

/** Resolve the four fields (overrides win; otherwise derive). */
export function resolveBusinessModel(input: BusinessModelClassifyInput): {
  businessCategory: BusinessCategoryKey;
  productExperience: ProductExperienceKey;
  dealType: DealTypeKey;
  editionBloom: string | null;
} {
  const productExperience = classifyProductExperience(input);
  const businessCategory = isBusinessCategoryKey(input.businessCategory)
    ? input.businessCategory
    : PRODUCTS[productExperience].businessCategory;
  const edition =
    typeof input.editionBloom === "string" && input.editionBloom.trim()
      ? input.editionBloom.trim().slice(0, 200)
      : null;
  return {
    businessCategory,
    productExperience,
    dealType: classifyDealType(input),
    editionBloom: edition,
  };
}

/** Prefer opportunity metadata; fall back to organization defaults for category/product/deal. */
export function resolveBusinessModelFromMetadata(
  opportunityMetadata: unknown,
  organizationMetadata: unknown,
  extras?: Omit<BusinessModelClassifyInput, "businessCategory" | "productExperience" | "dealType" | "editionBloom">
): {
  businessCategory: BusinessCategoryKey;
  productExperience: ProductExperienceKey;
  dealType: DealTypeKey;
  editionBloom: string | null;
} {
  const opp = asMetadata(opportunityMetadata) ?? {};
  const org = asMetadata(organizationMetadata) ?? {};
  return resolveBusinessModel({
    ...extras,
    businessCategory: readBusinessCategory(opp) ?? readBusinessCategory(org),
    productExperience: readProductExperience(opp) ?? readProductExperience(org),
    dealType: readDealType(opp) ?? readDealType(org),
    editionBloom: readEditionBloom(opp) ?? readEditionBloom(org),
    revenueEngine: extras?.revenueEngine ?? (opp.revenueEngine as string | null) ?? (org.revenueEngine as string | null),
    flagshipOffer: extras?.flagshipOffer ?? (opp.flagshipOffer as string | null) ?? (org.flagshipOffer as string | null),
  });
}

export function withBusinessCategory(
  importMetadata: Record<string, unknown> | null | undefined,
  value: BusinessCategoryKey | null
): Record<string, unknown> {
  const next = { ...(importMetadata ?? {}) };
  if (value == null) delete next.businessCategory;
  else next.businessCategory = value;
  return next;
}

export function withProductExperience(
  importMetadata: Record<string, unknown> | null | undefined,
  value: ProductExperienceKey | null
): Record<string, unknown> {
  const next = { ...(importMetadata ?? {}) };
  if (value == null) {
    delete next.productExperience;
    return next;
  }
  next.productExperience = value;
  next.businessCategory = PRODUCTS[value].businessCategory;
  const offer = PRODUCTS[value].flagshipOffer;
  if (offer) {
    next.flagshipOffer = offer;
    // Keep engine aligned with the existing portfolio mapping when we have a flagship offer.
    if (offer === "anthem_experience") next.revenueEngine = "premium";
    else if (offer === "crowdsource_partnership") next.revenueEngine = "partnership";
    else if (offer === "song_garden") next.revenueEngine = "owned";
  } else if (PRODUCTS[value].businessCategory === "owned") {
    next.revenueEngine = "owned";
  } else if (!next.revenueEngine) {
    next.revenueEngine = "premium";
  }
  return next;
}

export function withDealType(
  importMetadata: Record<string, unknown> | null | undefined,
  value: DealTypeKey | null
): Record<string, unknown> {
  const next = { ...(importMetadata ?? {}) };
  if (value == null) delete next.dealType;
  else next.dealType = value;
  return next;
}

export function withEditionBloom(
  importMetadata: Record<string, unknown> | null | undefined,
  value: string | null
): Record<string, unknown> {
  const next = { ...(importMetadata ?? {}) };
  const trimmed = typeof value === "string" ? value.trim().slice(0, 200) : "";
  if (!trimmed) delete next.editionBloom;
  else next.editionBloom = trimmed;
  return next;
}

/** Map a new product back into the legacy workstream lens (for playbook effort mix). */
export function productToWorkstreamHint(
  product: ProductExperienceKey,
  dealType: DealTypeKey
): WorkstreamKey {
  if (PRODUCTS[product].businessCategory === "owned") return "owned";
  if (dealType === "sponsorship") return "sponsor";
  if (product === "fan_chant" || dealType === "strategic_partnership") return "partnership";
  return "premium";
}

export function isHighValueOpportunity(potentialAmount: number | null | undefined): boolean {
  return potentialAmount != null && potentialAmount >= HIGH_VALUE_POTENTIAL_USD;
}
