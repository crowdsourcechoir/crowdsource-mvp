/**
 * Revenue engines + flagship offers for the three-engine portfolio plan.
 *
 * Stored on opportunities.import_metadata (and optionally orgs as default) —
 * same jsonb pattern as salesInitiative; no SQL migration required.
 */

export const REVENUE_ENGINES = {
  premium: {
    key: "premium",
    label: "Premium",
    shortLabel: "Premium",
    description: "High-margin Anthem Experiences — conferences, fundraisers, corporate year-end.",
    defaultOfferKey: "anthem_experience" as const,
  },
  partnership: {
    key: "partnership",
    label: "Partnership",
    shortLabel: "Partner",
    description: "Recurring seasonal or annual contracts — sports, residencies, sponsors.",
    defaultOfferKey: "crowdsource_partnership" as const,
  },
  owned: {
    key: "owned",
    label: "Owned",
    shortLabel: "Owned",
    description: "Song Garden and other CSC-owned public programming — venue + sponsor + tickets.",
    defaultOfferKey: "song_garden" as const,
  },
} as const;

export type RevenueEngineKey = keyof typeof REVENUE_ENGINES;

export const FLAGSHIP_OFFERS = {
  anthem_experience: {
    key: "anthem_experience",
    label: "Anthem Experience",
    engine: "premium" as const,
    description: "Flagship premium participatory experience.",
  },
  crowdsource_partnership: {
    key: "crowdsource_partnership",
    label: "Crowdsource Partnership",
    engine: "partnership" as const,
    description: "Seasonal or annual recurring partnership.",
  },
  song_garden: {
    key: "song_garden",
    label: "Song Garden",
    engine: "owned" as const,
    description: "Owned public programming residency or series.",
  },
} as const;

export type FlagshipOfferKey = keyof typeof FLAGSHIP_OFFERS;

export const REVENUE_ENGINE_KEYS = Object.keys(REVENUE_ENGINES) as RevenueEngineKey[];
export const FLAGSHIP_OFFER_KEYS = Object.keys(FLAGSHIP_OFFERS) as FlagshipOfferKey[];

/** Suggested package amounts used as placeholders in deal forms (USD). */
export const DEFAULT_PACKAGE_SUGGESTIONS: Record<FlagshipOfferKey, number> = {
  anthem_experience: 15_000,
  crowdsource_partnership: 5_000,
  song_garden: 3_000,
};

/** Gross monthly run-rate targets (USD) — context for Sales / Settings, not a ledger. */
export const RUN_RATE_TARGETS = {
  survival: 15_000,
  baseline: 30_000,
  growth: 50_000,
} as const;

export type DealEconomics = {
  bookedAmount: number | null;
  cashCollected: number | null;
  earnedAmount: number | null;
};

export function isRevenueEngineKey(value: unknown): value is RevenueEngineKey {
  return typeof value === "string" && value in REVENUE_ENGINES;
}

export function isFlagshipOfferKey(value: unknown): value is FlagshipOfferKey {
  return typeof value === "string" && value in FLAGSHIP_OFFERS;
}

function asMetadata(importMetadata: unknown): Record<string, unknown> | null {
  if (!importMetadata || typeof importMetadata !== "object") return null;
  return importMetadata as Record<string, unknown>;
}

export function readRevenueEngine(importMetadata: unknown): RevenueEngineKey | null {
  const meta = asMetadata(importMetadata);
  if (!meta) return null;
  return isRevenueEngineKey(meta.revenueEngine) ? meta.revenueEngine : null;
}

export function readFlagshipOffer(importMetadata: unknown): FlagshipOfferKey | null {
  const meta = asMetadata(importMetadata);
  if (!meta) return null;
  return isFlagshipOfferKey(meta.flagshipOffer) ? meta.flagshipOffer : null;
}

/** Prefer opportunity metadata; fall back to organization default. */
export function resolveRevenueEngine(
  opportunityMetadata: unknown,
  organizationMetadata?: unknown
): RevenueEngineKey | null {
  return readRevenueEngine(opportunityMetadata) ?? readRevenueEngine(organizationMetadata);
}

export function resolveFlagshipOffer(
  opportunityMetadata: unknown,
  organizationMetadata?: unknown
): FlagshipOfferKey | null {
  const fromOpp = readFlagshipOffer(opportunityMetadata);
  if (fromOpp) return fromOpp;
  const fromOrg = readFlagshipOffer(organizationMetadata);
  if (fromOrg) return fromOrg;
  const engine = resolveRevenueEngine(opportunityMetadata, organizationMetadata);
  return engine ? REVENUE_ENGINES[engine].defaultOfferKey : null;
}

export function withRevenueEngine(
  importMetadata: Record<string, unknown> | null | undefined,
  engine: RevenueEngineKey | null
): Record<string, unknown> {
  const next = { ...(importMetadata ?? {}) };
  if (engine == null) {
    delete next.revenueEngine;
  } else {
    next.revenueEngine = engine;
    const offer = readFlagshipOffer(next);
    if (!offer || FLAGSHIP_OFFERS[offer].engine !== engine) {
      next.flagshipOffer = REVENUE_ENGINES[engine].defaultOfferKey;
    }
  }
  return next;
}

export function withFlagshipOffer(
  importMetadata: Record<string, unknown> | null | undefined,
  offer: FlagshipOfferKey | null
): Record<string, unknown> {
  const next = { ...(importMetadata ?? {}) };
  if (offer == null) {
    delete next.flagshipOffer;
  } else {
    next.flagshipOffer = offer;
    next.revenueEngine = FLAGSHIP_OFFERS[offer].engine;
  }
  return next;
}

function coerceMoney(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function readDealEconomics(importMetadata: unknown): DealEconomics {
  const meta = asMetadata(importMetadata);
  if (!meta) return { bookedAmount: null, cashCollected: null, earnedAmount: null };
  return {
    bookedAmount: coerceMoney(meta.bookedAmount),
    cashCollected: coerceMoney(meta.cashCollected),
    earnedAmount: coerceMoney(meta.earnedAmount),
  };
}

export type DealEconomicsPatch = {
  bookedAmount?: number | string | null;
  cashCollected?: number | string | null;
  earnedAmount?: number | string | null;
};

export function withDealEconomics(
  importMetadata: Record<string, unknown> | null | undefined,
  patch: DealEconomicsPatch
): Record<string, unknown> {
  const next = { ...(importMetadata ?? {}) };
  const current = readDealEconomics(next);
  const merged: DealEconomics = {
    bookedAmount: patch.bookedAmount !== undefined ? coerceMoney(patch.bookedAmount) : current.bookedAmount,
    cashCollected:
      patch.cashCollected !== undefined ? coerceMoney(patch.cashCollected) : current.cashCollected,
    earnedAmount: patch.earnedAmount !== undefined ? coerceMoney(patch.earnedAmount) : current.earnedAmount,
  };
  if (merged.bookedAmount == null) delete next.bookedAmount;
  else next.bookedAmount = merged.bookedAmount;
  if (merged.cashCollected == null) delete next.cashCollected;
  else next.cashCollected = merged.cashCollected;
  if (merged.earnedAmount == null) delete next.earnedAmount;
  else next.earnedAmount = merged.earnedAmount;
  return next;
}

export function formatUsd(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function sumDealField(
  rows: Array<{ importMetadata?: unknown } | null | undefined>,
  field: keyof DealEconomics
): number {
  let total = 0;
  for (const row of rows) {
    const value = readDealEconomics(row?.importMetadata)[field];
    if (value != null) total += value;
  }
  return total;
}
