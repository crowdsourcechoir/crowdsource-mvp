import assert from "node:assert/strict";
import {
  isDoNotProspect,
  looksLikeStateOrRegionalAssociation,
  organizationHasBeenContacted,
  withDoNotProspect,
} from "./do-not-prospect";

assert.equal(looksLikeStateOrRegionalAssociation("Oregon Library Association"), true);
assert.equal(looksLikeStateOrRegionalAssociation("Washington State Hospital Association"), true);
assert.equal(looksLikeStateOrRegionalAssociation("Michigan Society of Association Executives"), true);
assert.equal(looksLikeStateOrRegionalAssociation("Council of Michigan Foundations"), true);
assert.equal(looksLikeStateOrRegionalAssociation("American Library Association"), false);
assert.equal(looksLikeStateOrRegionalAssociation("National Art Education Association"), false);
assert.equal(looksLikeStateOrRegionalAssociation("Seattle Seahawks"), false);

assert.equal(isDoNotProspect(null), false);
const flagged = withDoNotProspect({ seededWithContacts: true }, "state_or_regional_association");
assert.equal(isDoNotProspect(flagged), true);
assert.equal(flagged.seededWithContacts, true);

assert.equal(organizationHasBeenContacted([{ lastOutboundAt: null, lastInboundAt: null, gmailThreadId: null }]), false);
assert.equal(organizationHasBeenContacted([{ lastOutboundAt: "2026-09-01T00:00:00Z" }]), true);

console.log("do-not-prospect tests passed");
