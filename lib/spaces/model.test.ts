import assert from "node:assert/strict";
import {
  addDeal,
  canonicalHref,
  claimAccount,
  EMPTY_CLIENT_SPACES,
  normalizeClientSpaces,
  placedPitchHref,
  placementIsShareable,
  removePlacement,
  renameAccount,
  resolveSpace,
  savePlacement,
  setAccountPassword,
  updateDeal,
  type ClientSpacesState,
} from "./model";

const ORG = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const OPP = "33333333-3333-4333-8333-333333333333";
const OPP_2 = "44444444-4444-4444-8444-444444444444";

function workspace(): ClientSpacesState {
  const claimed = claimAccount(EMPTY_CLIENT_SPACES, { organizationId: ORG, slug: "nafsa", passwordHash: "salt:hash" });
  if ("error" in claimed) throw new Error(claimed.error);
  const deal = addDeal(claimed.state, {
    id: "deal_aaaa1111",
    organizationId: ORG,
    name: "NAFSA 2027",
    slug: "2027",
    salesOpportunityId: OPP,
  });
  if ("error" in deal) throw new Error(deal.error);
  const deck = savePlacement(deal.state, {
    id: "place_aaaa1111",
    dealId: deal.deal.id,
    role: "deck",
    title: "NAFSA anthem",
    pitchId: "pitch_abcdef",
    published: true,
  });
  if ("error" in deck) throw new Error(deck.error);
  const proposal = savePlacement(deck.state, {
    id: "place_bbbb2222",
    dealId: deal.deal.id,
    role: "proposal",
    title: "Proposal",
    linkUrl: "https://dropbox.com/sign/nafsa",
    linkLabel: "Sign",
    published: true,
  });
  if ("error" in proposal) throw new Error(proposal.error);
  return proposal.state;
}

const state = workspace();
const deal = state.deals[0];
const deck = state.placements.find((item) => item.role === "deck");
const proposal = state.placements.find((item) => item.role === "proposal");
if (!deck || !proposal) throw new Error("rows missing");

assert.equal(deck.pathSlug, null);
assert.equal(proposal.pathSlug, "proposal");
assert.equal(proposal.published, true);
assert.equal(canonicalHref(state.accounts[0], deal, deck), "/for/nafsa");
assert.equal(canonicalHref(state.accounts[0], deal, proposal), "/for/nafsa/proposal");

const root = resolveSpace(state, ["nafsa"]);
assert.equal(root.kind, "document");
if (root.kind === "document") assert.equal(root.placement.role, "deck");

const proposalPage = resolveSpace(state, ["nafsa", "proposal"]);
assert.equal(proposalPage.kind, "document");
if (proposalPage.kind === "document") assert.equal(proposalPage.placement.role, "proposal");

const longRoot = resolveSpace(state, ["nafsa", "2027"]);
assert.equal(longRoot.kind, "document");
if (longRoot.kind === "document") assert.equal(longRoot.placement.role, "deck");

const renamedProposal = savePlacement(state, { dealId: deal.id, role: "proposal", pathSlug: "agreement" });
if ("error" in renamedProposal) throw new Error(renamedProposal.error);
const oldProposal = resolveSpace(renamedProposal.state, ["nafsa", "proposal"]);
assert.equal(oldProposal.kind, "redirect");
if (oldProposal.kind === "redirect") assert.equal(oldProposal.href, "/for/nafsa/agreement");

const later = addDeal(state, {
  id: "deal_bbbb2222",
  organizationId: ORG,
  name: "NAFSA 2028",
  slug: "2028",
  salesOpportunityId: OPP_2,
});
if ("error" in later) throw new Error(later.error);
assert.equal(later.deal.current, false);
const laterDeck = savePlacement(later.state, {
  id: "place_cccc3333",
  dealId: later.deal.id,
  role: "deck",
  pitchId: "pitch_bbbbbb",
  published: true,
});
if ("error" in laterDeck) throw new Error(laterDeck.error);
const laterProposal = savePlacement(laterDeck.state, {
  id: "place_dddd4444",
  dealId: later.deal.id,
  role: "proposal",
  linkUrl: "https://dropbox.com/sign/2028",
  published: true,
});
if ("error" in laterProposal) throw new Error(laterProposal.error);
const year = resolveSpace(laterProposal.state, ["nafsa", "2028"]);
assert.equal(year.kind, "document");
if (year.kind === "document") assert.equal(year.placement.pitchId, "pitch_bbbbbb");
const yearProposal = resolveSpace(laterProposal.state, ["nafsa", "2028", "proposal"]);
assert.equal(yearProposal.kind, "document");
if (yearProposal.kind === "document") assert.equal(yearProposal.placement.dealId, later.deal.id);

const madeCurrent = updateDeal(laterProposal.state, later.deal.id, { current: true });
if ("error" in madeCurrent) throw new Error(madeCurrent.error);
const shortNow = resolveSpace(madeCurrent.state, ["nafsa", "proposal"]);
assert.equal(shortNow.kind, "document");
if (shortNow.kind === "document") assert.equal(shortNow.placement.dealId, later.deal.id);
const kept = resolveSpace(madeCurrent.state, ["nafsa", "2027", "proposal"]);
assert.equal(kept.kind, "document");
if (kept.kind === "document") assert.equal(kept.placement.dealId, deal.id);

const renamed = renameAccount(state, ORG, "nafsa-dc");
if ("error" in renamed) throw new Error(renamed.error);
const fromOld = resolveSpace(renamed.state, ["nafsa", "proposal"]);
assert.equal(fromOld.kind, "redirect");
if (fromOld.kind === "redirect") assert.equal(fromOld.href, "/for/nafsa-dc/proposal");

const back = renameAccount(renamed.state, ORG, "nafsa");
if ("error" in back) throw new Error(back.error);
assert.equal(back.account.slug, "nafsa");

const taken = claimAccount(state, { organizationId: ORG_B, slug: "nafsa", passwordHash: null });
assert.equal("error" in taken, true);

const shadow = addDeal(state, { id: "deal_eeee5555", organizationId: ORG, name: "Other", slug: "proposal" });
assert.equal("error" in shadow, true);

const notes = savePlacement(state, { id: "place_eeee5555", dealId: deal.id, role: "notes", body: "Call Friday." });
if ("error" in notes) throw new Error(notes.error);
const note = notes.placement;
assert.equal(note.published, false);
assert.equal(note.pathSlug, "notes");
assert.equal(placementIsShareable(note, null), false);
assert.equal(placementIsShareable({ ...note, published: true }, null), true);
assert.equal(placementIsShareable(deck, false), false);
assert.equal(placementIsShareable(deck, true), true);
assert.equal(placedPitchHref(state, "pitch_abcdef"), "/for/nafsa");

const removed = removePlacement(notes.state, deal.id, "notes");
if ("error" in removed) throw new Error(removed.error);
assert.equal(removed.state.placements.some((item) => item.role === "notes"), false);

const locked = setAccountPassword(state, ORG, null);
if ("error" in locked) throw new Error(locked.error);
assert.equal(locked.account.passwordHash, null);

const normalized = normalizeClientSpaces({
  accounts: [
    { organizationId: ORG.toUpperCase(), slug: "NAFSA", passwordHash: "salt:hash", previousSlugs: ["old-nafsa", "nafsa"] },
    { organizationId: "nope", slug: "x" },
  ],
  deals: [
    {
      id: "deal_aaaa1111",
      organizationId: ORG,
      name: "NAFSA 2027",
      slug: "2027",
      current: true,
      salesOpportunityId: OPP,
      previousSlugs: [],
    },
  ],
  placements: [
    { id: "place_aaaa1111", dealId: "deal_aaaa1111", role: "deck", title: "Deck", published: true, pitchId: "pitch_abcdef" },
    { id: "not-an-id", dealId: "deal_aaaa1111", role: "show" },
  ],
});
assert.equal(normalized.accounts.length, 1);
assert.equal(normalized.accounts[0].slug, "nafsa");
assert.deepEqual(normalized.accounts[0].previousSlugs, ["old-nafsa"]);
assert.equal(normalized.placements.length, 1);
assert.equal(resolveSpace(normalized, ["old-nafsa"]).kind, "redirect");

console.log("spaces model ok");
