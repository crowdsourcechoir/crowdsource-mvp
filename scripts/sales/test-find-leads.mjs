/**
 * Find-leads intent parser.
 * Run: npx tsx scripts/sales/test-find-leads.mjs
 */
import assert from "node:assert/strict";
import { contactRoleRank, parseFindIntent, similarFocusForOrg } from "../../lib/sales/find-leads.ts";

const contact = parseFindIntent("find me the fan engagement person at this org");
assert.equal(contact.action, "contact");
assert.match(contact.roleHint ?? "", /fan engagement/);
assert.equal(contact.organizationName, null);

const named = parseFindIntent("find the fan engagement person at Seattle Sounders");
assert.equal(named.action, "contact");
assert.equal(named.organizationName, "Seattle Sounders");

const similar = parseFindIntent("find me 10 more equivalent leads to this one");
assert.equal(similar.action, "similar");
assert.equal(similar.count, 10);

const discover = parseFindIntent("D1 basketball athletic departments");
assert.equal(discover.action, "discover");
assert.match(discover.focus ?? "", /D1 basketball/);

const fill = parseFindIntent("fill the queue");
assert.equal(fill.action, "fill_queue");

const focus = similarFocusForOrg({
  name: "Gonzaga",
  typeLabel: "Sports team",
  city: "Spokane",
  region: "WA",
});
assert.match(focus, /Sports teams like Gonzaga/);
assert.match(focus, /Spokane/);

assert.ok(contactRoleRank("Director of Fan Engagement", "fan engagement marketing") > contactRoleRank("Accountant", "fan engagement marketing"));
assert.equal(contactRoleRank(null, "fan engagement"), 0);

console.log("find-leads intent ok");
