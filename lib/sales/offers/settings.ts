import {
  DEFAULT_PACKAGE_SUGGESTIONS,
  FLAGSHIP_OFFERS,
  REVENUE_ENGINES,
  RUN_RATE_TARGETS,
  type FlagshipOfferKey,
} from "@/lib/sales/engines";
import { readWorkspaceSettings, type SalesOffersSettingsOverrides } from "@/lib/settings/store";

export type ResolvedSalesOffersSettings = {
  suggestions: Record<FlagshipOfferKey, number>;
  overrides: SalesOffersSettingsOverrides;
  engines: typeof REVENUE_ENGINES;
  offers: typeof FLAGSHIP_OFFERS;
  runRateTargets: typeof RUN_RATE_TARGETS;
  persisted: boolean;
  storeError: string | null;
};

export async function resolveSalesOffersSettings(): Promise<ResolvedSalesOffersSettings> {
  const { settings, persisted, error } = await readWorkspaceSettings();
  const o = settings.salesOffers;
  return {
    suggestions: {
      anthem_experience: o.anthemExperienceAmount ?? DEFAULT_PACKAGE_SUGGESTIONS.anthem_experience,
      crowdsource_partnership:
        o.partnershipMonthlyAmount ?? DEFAULT_PACKAGE_SUGGESTIONS.crowdsource_partnership,
      song_garden: o.songGardenAmount ?? DEFAULT_PACKAGE_SUGGESTIONS.song_garden,
    },
    overrides: o,
    engines: REVENUE_ENGINES,
    offers: FLAGSHIP_OFFERS,
    runRateTargets: RUN_RATE_TARGETS,
    persisted,
    storeError: error,
  };
}
