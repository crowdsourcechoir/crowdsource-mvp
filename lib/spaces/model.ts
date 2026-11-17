/**
 * Client workspaces: one public slug per sales organization, one deal per
 * opportunity, and the materials that belong on that deal.
 *
 * Public addresses never use the word "pitch":
 *   /for/nafsa                  current deal's root (usually the deck)
 *   /for/nafsa/proposal         current deal's proposal
 *   /for/nafsa/2028             a later deal
 *   /for/nafsa/2028/proposal
 *
 * Slugs stay editable. The previous slug keeps resolving and redirects.
 */

export const SPACE_ROLES = ["deck", "proposal", "show", "notes"] as const;
export type SpaceRole = (typeof SPACE_ROLES)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEAL_ID = /^deal_[a-f0-9]{8}$/;
const PLACE_ID = /^place_[a-f0-9]{8}$/;
const PITCH_ID = /^[a-z0-9][a-z0-9_-]{0,78}$/;
const MAX_SLUG = 60;
const MAX_NAME = 120;
const MAX_BODY = 8000;
const MAX_URL = 2000;
const MAX_LABEL = 80;
const MAX_ACCOUNTS = 500;
const MAX_DEALS = 1000;
const MAX_PREVIOUS = 20;

export type SpaceAccount = {
  organizationId: string;
  slug: string;
  passwordHash: string | null;
  previousSlugs: string[];
};

export type SpaceDeal = {
  id: string;
  organizationId: string;
  salesOpportunityId: string | null;
  name: string;
  slug: string;
  current: boolean;
  previousSlugs: string[];
};

export type SpacePlacement = {
  id: string;
  dealId: string;
  role: SpaceRole;
  /** Blank means this piece is the root of its deal. */
  pathSlug: string | null;
  title: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  /** Notes start private. A deck also follows its pitch's live flag. */
  published: boolean;
  pitchId: string | null;
  previousPathSlugs: string[];
};

export type ClientSpacesState = {
  accounts: SpaceAccount[];
  deals: SpaceDeal[];
  placements: SpacePlacement[];
};

export const EMPTY_CLIENT_SPACES: ClientSpacesState = { accounts: [], deals: [], placements: [] };

export type SpaceResolution =
  | { kind: "none" }
  | { kind: "redirect"; href: string }
  | { kind: "document"; account: SpaceAccount; deal: SpaceDeal; placement: SpacePlacement }
  | { kind: "index"; account: SpaceAccount; deal: SpaceDeal };

export function spaceSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG);
}

export function defaultPathSlug(role: SpaceRole): string | null {
  return role === "deck" ? null : role;
}

export function roleLabel(role: SpaceRole): string {
  if (role === "deck") return "Deck";
  if (role === "proposal") return "Proposal";
  if (role === "show") return "Show";
  return "Notes";
}

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function uuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim().toLowerCase();
  return UUID.test(id) ? id : null;
}

function slug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const next = spaceSlug(value);
  return next && SLUG.test(next) ? next : null;
}

function hash(value: unknown): string | null {
  return typeof value === "string" && value.includes(":") ? value : null;
}

function linkUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim().slice(0, MAX_URL);
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

function uniqueList(values: unknown, reject: Set<string>): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const value of values) {
    const next = slug(value);
    if (!next || reject.has(next) || out.includes(next)) continue;
    out.push(next);
    if (out.length >= MAX_PREVIOUS) break;
  }
  return out;
}

function roleFrom(value: unknown): SpaceRole | null {
  return SPACE_ROLES.find((role) => role === value) ?? null;
}

export function normalizeClientSpaces(raw: unknown): ClientSpacesState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_CLIENT_SPACES;
  const source = raw as Partial<ClientSpacesState>;

  const accounts: SpaceAccount[] = [];
  const seenOrg = new Set<string>();
  const seenSlug = new Set<string>();
  for (const item of Array.isArray(source.accounts) ? source.accounts : []) {
    if (!item || typeof item !== "object") continue;
    const row = item as SpaceAccount;
    const organizationId = uuid(row.organizationId);
    const accountSlug = slug(row.slug);
    if (!organizationId || !accountSlug || seenOrg.has(organizationId) || seenSlug.has(accountSlug)) continue;
    seenOrg.add(organizationId);
    seenSlug.add(accountSlug);
    accounts.push({
      organizationId,
      slug: accountSlug,
      passwordHash: hash(row.passwordHash),
      previousSlugs: uniqueList(row.previousSlugs, new Set([accountSlug])),
    });
    if (accounts.length >= MAX_ACCOUNTS) break;
  }
  for (const account of accounts) {
    account.previousSlugs = account.previousSlugs.filter((previous) => {
      if (previous === account.slug) return false;
      return !accounts.some(
        (other) =>
          other.organizationId !== account.organizationId &&
          (other.slug === previous || other.previousSlugs.includes(previous))
      );
    });
  }

  const deals: SpaceDeal[] = [];
  const seenDeal = new Set<string>();
  const seenOpportunity = new Set<string>();
  const dealSlugs = new Map<string, Set<string>>();
  for (const item of Array.isArray(source.deals) ? source.deals : []) {
    if (!item || typeof item !== "object") continue;
    const row = item as SpaceDeal;
    const id = typeof row.id === "string" && DEAL_ID.test(row.id) ? row.id : "";
    const organizationId = uuid(row.organizationId);
    const dealSlug = slug(row.slug);
    const name = clip(row.name, MAX_NAME);
    if (!id || !organizationId || !dealSlug || !name || seenDeal.has(id)) continue;
    if (!accounts.some((account) => account.organizationId === organizationId)) continue;
    const salesOpportunityId = row.salesOpportunityId == null ? null : uuid(row.salesOpportunityId);
    if (row.salesOpportunityId != null && !salesOpportunityId) continue;
    if (salesOpportunityId && seenOpportunity.has(salesOpportunityId)) continue;
    const taken = dealSlugs.get(organizationId) ?? new Set<string>();
    if (taken.has(dealSlug)) continue;
    taken.add(dealSlug);
    dealSlugs.set(organizationId, taken);
    seenDeal.add(id);
    if (salesOpportunityId) seenOpportunity.add(salesOpportunityId);
    deals.push({
      id,
      organizationId,
      salesOpportunityId,
      name,
      slug: dealSlug,
      current: row.current === true,
      previousSlugs: uniqueList(row.previousSlugs, new Set([dealSlug])),
    });
    if (deals.length >= MAX_DEALS) break;
  }
  for (const account of accounts) {
    const mine = deals.filter((deal) => deal.organizationId === account.organizationId);
    const current = mine.find((deal) => deal.current);
    for (const deal of mine) deal.current = current ? deal.id === current.id : deal.id === mine[0]?.id;
    const live = new Set(mine.map((deal) => deal.slug));
    for (const deal of mine) {
      deal.previousSlugs = deal.previousSlugs.filter((previous) => previous !== deal.slug && !live.has(previous));
    }
  }

  const placements: SpacePlacement[] = [];
  const seenPlace = new Set<string>();
  const seenRole = new Set<string>();
  const seenPitch = new Set<string>();
  for (const item of Array.isArray(source.placements) ? source.placements : []) {
    if (!item || typeof item !== "object") continue;
    const row = item as SpacePlacement;
    const id = typeof row.id === "string" && PLACE_ID.test(row.id) ? row.id : "";
    const role = roleFrom(row.role);
    const deal = deals.find((candidate) => candidate.id === row.dealId);
    if (!id || !role || !deal || seenPlace.has(id)) continue;
    const roleKey = `${deal.id}:${role}`;
    if (seenRole.has(roleKey)) continue;
    const pathSlug = row.pathSlug == null || row.pathSlug === "" ? null : slug(row.pathSlug);
    if (row.pathSlug != null && row.pathSlug !== "" && !pathSlug) continue;
    const siblings = placements.filter((placement) => placement.dealId === deal.id);
    if (siblings.some((placement) => placement.pathSlug === pathSlug)) continue;
    const pitchId = typeof row.pitchId === "string" && PITCH_ID.test(row.pitchId) ? row.pitchId : null;
    if (row.pitchId != null && row.pitchId !== "" && !pitchId) continue;
    if (pitchId && seenPitch.has(pitchId)) continue;
    seenPlace.add(id);
    seenRole.add(roleKey);
    if (pitchId) seenPitch.add(pitchId);
    const title = clip(row.title, MAX_NAME) || roleLabel(role);
    placements.push({
      id,
      dealId: deal.id,
      role,
      pathSlug,
      title,
      body: clip(row.body, MAX_BODY),
      linkUrl: linkUrl(row.linkUrl),
      linkLabel: clip(row.linkLabel, MAX_LABEL) || null,
      published: row.published === true,
      pitchId,
      previousPathSlugs: uniqueList(row.previousPathSlugs, new Set(pathSlug ? [pathSlug] : [])),
    });
  }

  return { accounts, deals, placements };
}

export function canonicalHref(account: SpaceAccount, deal: SpaceDeal, placement: SpacePlacement | null): string {
  const parts = [account.slug];
  if (!deal.current) parts.push(deal.slug);
  if (placement?.pathSlug) parts.push(placement.pathSlug);
  return `/for/${parts.join("/")}`;
}

export function placedPitchHref(state: ClientSpacesState, pitchId: string): string | null {
  const placement = state.placements.find((item) => item.pitchId === pitchId);
  if (!placement) return null;
  const deal = state.deals.find((item) => item.id === placement.dealId);
  if (!deal) return null;
  const account = state.accounts.find((item) => item.organizationId === deal.organizationId);
  if (!account) return null;
  return canonicalHref(account, deal, placement);
}

function dealsFor(state: ClientSpacesState, organizationId: string): SpaceDeal[] {
  return state.deals.filter((deal) => deal.organizationId === organizationId);
}

function currentDeal(deals: SpaceDeal[]): SpaceDeal | null {
  return deals.find((deal) => deal.current) ?? deals[0] ?? null;
}

function findDeal(deals: SpaceDeal[], segment: string): { deal: SpaceDeal; previous: boolean } | null {
  const live = deals.find((deal) => deal.slug === segment);
  if (live) return { deal: live, previous: false };
  const previous = deals.find((deal) => deal.previousSlugs.includes(segment));
  return previous ? { deal: previous, previous: true } : null;
}

function findPlacement(placements: SpacePlacement[], dealId: string, segment: string | null): SpacePlacement | null {
  return placements.find((placement) => placement.dealId === dealId && placement.pathSlug === segment) ?? null;
}

function findPreviousPlacement(placements: SpacePlacement[], dealId: string, segment: string): SpacePlacement | null {
  return placements.find((placement) => placement.dealId === dealId && placement.previousPathSlugs.includes(segment)) ?? null;
}

/**
 * A deck with a pitch is shareable when that pitch is live.
 * Notes stay private until published and written.
 * A proposal or show is shareable once it is published.
 */
export function placementIsShareable(placement: SpacePlacement, pitchLive: boolean | null): boolean {
  if (!placement.published) return false;
  if (placement.pitchId) return pitchLive === true;
  if (placement.role === "notes") return placement.body.trim().length > 0;
  if (placement.role === "deck") return Boolean(placement.linkUrl || placement.body.trim());
  return true;
}

export function resolveSpace(state: ClientSpacesState, segments: string[]): SpaceResolution {
  const clean = segments.map((segment) => segment.trim().toLowerCase()).filter(Boolean);
  if (clean.length < 1 || clean.length > 3) return { kind: "none" };
  if (clean.some((segment) => !SLUG.test(segment))) return { kind: "none" };

  const account =
    state.accounts.find((item) => item.slug === clean[0]) ??
    state.accounts.find((item) => item.previousSlugs.includes(clean[0]));
  if (!account) return { kind: "none" };
  if (account.slug !== clean[0]) {
    const next = resolveSpace(state, [account.slug, ...clean.slice(1)]);
    if (next.kind === "document") return { kind: "redirect", href: canonicalHref(next.account, next.deal, next.placement) };
    if (next.kind === "index") return { kind: "redirect", href: canonicalHref(next.account, next.deal, null) };
    if (next.kind === "redirect") return next;
    return { kind: "redirect", href: `/for/${account.slug}` };
  }

  const deals = dealsFor(state, account.organizationId);
  const current = currentDeal(deals);
  if (!current) {
    return clean.length === 1 ? { kind: "index", account, deal: placeholderDeal(account) } : { kind: "none" };
  }

  const requested = `/for/${clean.join("/")}`;
  if (clean.length === 1) return serveRoot(state, account, current, requested);
  if (clean.length === 2) return serveOne(state, account, deals, current, clean[1], requested);
  return serveTwo(state, account, deals, clean[1], clean[2], requested);
}

function placeholderDeal(account: SpaceAccount): SpaceDeal {
  return {
    id: "deal_00000000",
    organizationId: account.organizationId,
    salesOpportunityId: null,
    name: account.slug,
    slug: "current",
    current: true,
    previousSlugs: [],
  };
}

function serveRoot(state: ClientSpacesState, account: SpaceAccount, deal: SpaceDeal, requested: string): SpaceResolution {
  const root = findPlacement(state.placements, deal.id, null);
  if (root) return { kind: "document", account, deal, placement: root };
  if (requested !== canonicalHref(account, deal, null)) return { kind: "redirect", href: canonicalHref(account, deal, null) };
  return { kind: "index", account, deal };
}

function serveOne(
  state: ClientSpacesState,
  account: SpaceAccount,
  deals: SpaceDeal[],
  current: SpaceDeal,
  segment: string,
  requested: string
): SpaceResolution {
  const doc = findPlacement(state.placements, current.id, segment);
  if (doc) return { kind: "document", account, deal: current, placement: doc };
  const renamed = findPreviousPlacement(state.placements, current.id, segment);
  if (renamed) {
    const href = canonicalHref(account, current, renamed);
    return href === requested ? { kind: "document", account, deal: current, placement: renamed } : { kind: "redirect", href };
  }
  const match = findDeal(deals, segment);
  if (!match) return { kind: "none" };
  if (match.previous) return { kind: "redirect", href: canonicalHref(account, match.deal, null) };
  return serveRoot(state, account, match.deal, requested);
}

function serveTwo(
  state: ClientSpacesState,
  account: SpaceAccount,
  deals: SpaceDeal[],
  dealSegment: string,
  docSegment: string,
  requested: string
): SpaceResolution {
  const match = findDeal(deals, dealSegment);
  if (!match) return { kind: "none" };
  const doc = findPlacement(state.placements, match.deal.id, docSegment);
  const renamed = doc ? null : findPreviousPlacement(state.placements, match.deal.id, docSegment);
  const placement = doc ?? renamed;
  if (!placement) {
    if (match.previous) return { kind: "redirect", href: canonicalHref(account, match.deal, null) };
    return { kind: "none" };
  }
  if (match.previous || renamed) {
    const href = canonicalHref(account, match.deal, placement);
    if (href !== requested) return { kind: "redirect", href };
  }
  return { kind: "document", account, deal: match.deal, placement };
}

function fail(error: string): { error: string } {
  return { error };
}

export function claimAccount(
  state: ClientSpacesState,
  input: { organizationId: string; slug: string; passwordHash: string | null }
): { state: ClientSpacesState; account: SpaceAccount } | { error: string } {
  const organizationId = uuid(input.organizationId);
  const accountSlug = slug(input.slug);
  if (!organizationId) return fail("Choose an organization.");
  if (!accountSlug) return fail("Use a short address, like nafsa.");
  if (state.accounts.some((account) => account.organizationId === organizationId)) {
    return fail("That organization already has a workspace.");
  }
  if (slugTaken(state, accountSlug, null)) return fail("That address is already in use.");
  const account: SpaceAccount = {
    organizationId,
    slug: accountSlug,
    passwordHash: hash(input.passwordHash),
    previousSlugs: [],
  };
  return { state: { ...state, accounts: [account, ...state.accounts] }, account };
}

function slugTaken(state: ClientSpacesState, accountSlug: string, exceptOrganizationId: string | null): boolean {
  return state.accounts.some((account) => {
    if (account.organizationId === exceptOrganizationId) return false;
    return account.slug === accountSlug || account.previousSlugs.includes(accountSlug);
  });
}

export function renameAccount(
  state: ClientSpacesState,
  organizationId: string,
  nextSlug: string
): { state: ClientSpacesState; account: SpaceAccount } | { error: string } {
  const account = state.accounts.find((item) => item.organizationId === organizationId);
  const accountSlug = slug(nextSlug);
  if (!account) return fail("That workspace was not found.");
  if (!accountSlug) return fail("Use a short address, like nafsa.");
  if (accountSlug === account.slug) return { state, account };
  if (slugTaken(state, accountSlug, account.organizationId)) return fail("That address is already in use.");
  const previousSlugs = [account.slug, ...account.previousSlugs.filter((item) => item !== accountSlug && item !== account.slug)].slice(0, MAX_PREVIOUS);
  const renamed: SpaceAccount = { ...account, slug: accountSlug, previousSlugs };
  return {
    state: { ...state, accounts: state.accounts.map((item) => (item.organizationId === organizationId ? renamed : item)) },
    account: renamed,
  };
}

export function setAccountPassword(
  state: ClientSpacesState,
  organizationId: string,
  passwordHash: string | null
): { state: ClientSpacesState; account: SpaceAccount } | { error: string } {
  const account = state.accounts.find((item) => item.organizationId === organizationId);
  if (!account) return fail("That workspace was not found.");
  const next: SpaceAccount = { ...account, passwordHash: passwordHash ? hash(passwordHash) : null };
  if (passwordHash && !next.passwordHash) return fail("Enter a password.");
  return {
    state: { ...state, accounts: state.accounts.map((item) => (item.organizationId === organizationId ? next : item)) },
    account: next,
  };
}

export function addDeal(
  state: ClientSpacesState,
  input: {
    id: string;
    organizationId: string;
    name: string;
    slug: string;
    salesOpportunityId?: string | null;
    current?: boolean;
  }
): { state: ClientSpacesState; deal: SpaceDeal } | { error: string } {
  const account = state.accounts.find((item) => item.organizationId === input.organizationId);
  if (!account) return fail("Start the workspace before adding a deal.");
  if (!DEAL_ID.test(input.id) || state.deals.some((deal) => deal.id === input.id)) return fail("Could not start that deal.");
  const name = clip(input.name, MAX_NAME);
  const dealSlug = slug(input.slug);
  if (!name) return fail("Name the deal.");
  if (!dealSlug) return fail("Use a short address for the deal, like 2027.");
  const salesOpportunityId = input.salesOpportunityId == null || input.salesOpportunityId === "" ? null : uuid(input.salesOpportunityId);
  if (input.salesOpportunityId && !salesOpportunityId) return fail("That opportunity was not found.");
  if (salesOpportunityId && state.deals.some((deal) => deal.salesOpportunityId === salesOpportunityId)) {
    return fail("That opportunity already has a workspace.");
  }
  const collision = dealSlugCollision(state, account.organizationId, dealSlug, null);
  if (collision) return fail(collision);
  const mine = dealsFor(state, account.organizationId);
  const makeCurrent = input.current === true || mine.length === 0;
  const deal: SpaceDeal = {
    id: input.id,
    organizationId: account.organizationId,
    salesOpportunityId,
    name,
    slug: dealSlug,
    current: makeCurrent,
    previousSlugs: [],
  };
  const deals = state.deals.map((item) =>
    makeCurrent && item.organizationId === account.organizationId ? { ...item, current: false } : item
  );
  return { state: { ...state, deals: [deal, ...deals] }, deal };
}

function dealSlugCollision(state: ClientSpacesState, organizationId: string, dealSlug: string, exceptDealId: string | null): string | null {
  const deals = dealsFor(state, organizationId);
  if (deals.some((deal) => deal.id !== exceptDealId && (deal.slug === dealSlug || deal.previousSlugs.includes(dealSlug)))) {
    return "That deal address is already in use.";
  }
  const current = deals.find((deal) => deal.current && deal.id !== exceptDealId);
  if (!current) return null;
  const blocked = state.placements.some(
    (placement) =>
      placement.dealId === current.id &&
      (placement.pathSlug === dealSlug || placement.previousPathSlugs.includes(dealSlug))
  );
  return blocked ? "That address is already a page on the current deal." : null;
}

export function updateDeal(
  state: ClientSpacesState,
  dealId: string,
  patch: { name?: string; slug?: string; current?: boolean }
): { state: ClientSpacesState; deal: SpaceDeal } | { error: string } {
  const deal = state.deals.find((item) => item.id === dealId);
  if (!deal) return fail("That deal was not found.");
  let next: SpaceDeal = { ...deal, previousSlugs: deal.previousSlugs.slice() };
  if (patch.name !== undefined) {
    const name = clip(patch.name, MAX_NAME);
    if (!name) return fail("Name the deal.");
    next.name = name;
  }
  if (patch.slug !== undefined) {
    const dealSlug = slug(patch.slug);
    if (!dealSlug) return fail("Use a short address for the deal, like 2027.");
    if (dealSlug !== deal.slug) {
      const collision = dealSlugCollision(state, deal.organizationId, dealSlug, deal.id);
      if (collision) return fail(collision);
      const ownPage = state.placements.some(
        (placement) => placement.dealId === deal.id && (placement.pathSlug === dealSlug || placement.previousPathSlugs.includes(dealSlug))
      );
      if (ownPage) return fail("That address is already a page on this deal.");
      next.previousSlugs = [deal.slug, ...next.previousSlugs.filter((item) => item !== dealSlug && item !== deal.slug)].slice(0, MAX_PREVIOUS);
      next.slug = dealSlug;
    }
  }
  let deals = state.deals.map((item) => (item.id === dealId ? next : item));
  if (patch.current === true) {
    deals = deals.map((item) =>
      item.organizationId === deal.organizationId ? { ...item, current: item.id === dealId } : item
    );
    next = deals.find((item) => item.id === dealId) ?? next;
  }
  return { state: { ...state, deals }, deal: next };
}

export type PlacementDraft = {
  id?: string;
  dealId: string;
  role: SpaceRole;
  title?: string;
  body?: string;
  pathSlug?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  published?: boolean;
  pitchId?: string | null;
};

export function savePlacement(
  state: ClientSpacesState,
  draft: PlacementDraft
): { state: ClientSpacesState; placement: SpacePlacement } | { error: string } {
  const deal = state.deals.find((item) => item.id === draft.dealId);
  const role = roleFrom(draft.role);
  if (!deal) return fail("That deal was not found.");
  if (!role) return fail("Choose a page.");
  const existing = state.placements.find((placement) => placement.dealId === deal.id && placement.role === role);
  const pathSlug = draft.pathSlug === undefined ? existing?.pathSlug ?? defaultPathSlug(role) : draft.pathSlug === null || draft.pathSlug === "" ? null : slug(draft.pathSlug);
  if (draft.pathSlug !== undefined && draft.pathSlug !== null && draft.pathSlug !== "" && !pathSlug) {
    return fail("Use a short address, like proposal.");
  }
  const account = state.accounts.find((item) => item.organizationId === deal.organizationId);
  if (pathSlug && account && pathSlug === account.slug) return fail("That address matches the organization.");
  const siblingSlug = state.placements.some(
    (placement) => placement.dealId === deal.id && placement.role !== role && placement.pathSlug === pathSlug
  );
  if (siblingSlug) return fail("That address is already used on this deal.");
  if (pathSlug && deal.current) {
    const shadowed = dealsFor(state, deal.organizationId).some(
      (item) => item.slug === pathSlug || item.previousSlugs.includes(pathSlug)
    );
    if (shadowed) return fail("That address is already a deal.");
  }
  if (pathSlug && (deal.slug === pathSlug || deal.previousSlugs.includes(pathSlug))) {
    return fail("That address is already this deal.");
  }
  let pitchId = draft.pitchId === undefined ? existing?.pitchId ?? null : draft.pitchId;
  if (pitchId === "") pitchId = null;
  if (pitchId && !PITCH_ID.test(pitchId)) return fail("That deck was not found.");
  if (pitchId && state.placements.some((placement) => placement.pitchId === pitchId && placement.id !== existing?.id)) {
    return fail("That deck is already filed on another page.");
  }
  const title = draft.title === undefined ? existing?.title ?? roleLabel(role) : clip(draft.title, MAX_NAME) || roleLabel(role);
  const body = draft.body === undefined ? existing?.body ?? "" : clip(draft.body, MAX_BODY);
  const nextLink = draft.linkUrl === undefined ? existing?.linkUrl ?? null : linkUrl(draft.linkUrl);
  if (draft.linkUrl && !nextLink) return fail("The link needs to start with https://");
  const linkLabel = draft.linkLabel === undefined ? existing?.linkLabel ?? null : clip(draft.linkLabel, MAX_LABEL) || null;
  const published =
    draft.published === undefined ? (existing?.published ?? (role !== "notes" && role !== "proposal")) : draft.published === true;
  const previous = existing?.previousPathSlugs.slice() ?? [];
  if (existing && existing.pathSlug !== pathSlug) {
    const old = existing.pathSlug;
    if (old && !previous.includes(old)) previous.unshift(old);
  }
  const placement: SpacePlacement = {
    id: existing?.id ?? draft.id ?? "",
    dealId: deal.id,
    role,
    pathSlug,
    title,
    body,
    linkUrl: nextLink,
    linkLabel,
    published,
    pitchId,
    previousPathSlugs: previous.filter((item) => item !== pathSlug).slice(0, MAX_PREVIOUS),
  };
  if (!PLACE_ID.test(placement.id)) return fail("Could not save that page.");
  const placements = existing
    ? state.placements.map((item) => (item.id === existing.id ? placement : item))
    : [placement, ...state.placements];
  return { state: { ...state, placements }, placement };
}

export function removePlacement(
  state: ClientSpacesState,
  dealId: string,
  role: SpaceRole
): { state: ClientSpacesState } | { error: string } {
  const existing = state.placements.find((placement) => placement.dealId === dealId && placement.role === role);
  if (!existing) return { state };
  return { state: { ...state, placements: state.placements.filter((placement) => placement.id !== existing.id) } };
}
