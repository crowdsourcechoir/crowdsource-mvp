import {
  canonicalHref,
  roleLabel,
  SPACE_ROLES,
  type ClientSpacesState,
  type SpaceAccount,
  type SpaceDeal,
  type SpacePlacement,
  type SpaceRole,
} from "@/lib/spaces/model";

export type SpacePitchBrief = {
  id: string;
  name: string;
  live: boolean;
  organizationId: string | null;
};

export type SpaceRowView = {
  role: SpaceRole;
  label: string;
  placementId: string | null;
  title: string;
  body: string;
  pathSlug: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  published: boolean;
  pitchId: string | null;
  pitchName: string | null;
  pitchLive: boolean | null;
  href: string | null;
};

export type SpaceDealView = {
  id: string;
  name: string;
  slug: string;
  current: boolean;
  salesOpportunityId: string | null;
  opportunityTitle: string | null;
  rows: SpaceRowView[];
};

export type SpaceAccountView = {
  organizationId: string;
  organizationName: string | null;
  slug: string;
  protected: boolean;
  deals: SpaceDealView[];
};

function rowView(
  account: SpaceAccount,
  deal: SpaceDeal,
  role: SpaceRole,
  placement: SpacePlacement | undefined,
  pitches: Map<string, SpacePitchBrief>
): SpaceRowView {
  const pitch = placement?.pitchId ? pitches.get(placement.pitchId) ?? null : null;
  return {
    role,
    label: roleLabel(role),
    placementId: placement?.id ?? null,
    title: placement?.title ?? roleLabel(role),
    body: placement?.body ?? "",
    pathSlug: placement?.pathSlug ?? null,
    linkUrl: placement?.linkUrl ?? null,
    linkLabel: placement?.linkLabel ?? null,
    published: placement?.published ?? false,
    pitchId: placement?.pitchId ?? null,
    pitchName: pitch?.name ?? null,
    pitchLive: pitch ? pitch.live : null,
    href: placement ? canonicalHref(account, deal, placement) : null,
  };
}

export function buildAccountViews(
  state: ClientSpacesState,
  names: Map<string, string>,
  opportunities: Map<string, string>,
  pitches: Map<string, SpacePitchBrief>
): SpaceAccountView[] {
  return state.accounts.map((account) => {
    const deals = state.deals
      .filter((deal) => deal.organizationId === account.organizationId)
      .sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name));
    return {
      organizationId: account.organizationId,
      organizationName: names.get(account.organizationId) ?? null,
      slug: account.slug,
      protected: Boolean(account.passwordHash),
      deals: deals.map((deal) => ({
        id: deal.id,
        name: deal.name,
        slug: deal.slug,
        current: deal.current,
        salesOpportunityId: deal.salesOpportunityId,
        opportunityTitle: deal.salesOpportunityId ? opportunities.get(deal.salesOpportunityId) ?? null : null,
        rows: SPACE_ROLES.map((role) =>
          rowView(
            account,
            deal,
            role,
            state.placements.find((placement) => placement.dealId === deal.id && placement.role === role),
            pitches
          )
        ),
      })),
    };
  });
}
