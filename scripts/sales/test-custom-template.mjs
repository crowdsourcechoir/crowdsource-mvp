import assert from "node:assert/strict";
import { buildCustomizedTemplateDraft } from "../../lib/sales/outreach/custom-template.ts";
import { looksLikeGenericTemplateDraft } from "../../lib/sales/outreach/customize-draft.ts";

const nahq = buildCustomizedTemplateDraft({
  firstName: "Alison",
  roleTitle: "Products and Programs Specialist – Events and Marketing",
  organizationName: "National Association for Healthcare Quality",
  opportunityTitle: "NAHQ — participatory anthem for NAHQ Next (Annual Conference)",
  category: "conferences",
});
assert.match(nahq.subject, /NAHQ Next/);
assert.match(nahq.body, /Hi Alison/);
assert.match(nahq.body, /NAHQ Next/);
assert.match(nahq.body, /Events and Marketing/);
assert.match(nahq.body, /www\.crowdsourcechoir\.com\/book/);
assert.doesNotMatch(nahq.body, /Seahawks|Pacific Northwest Ballet|I thought it might be a unique fit/);
assert.equal(looksLikeGenericTemplateDraft(nahq.body), false);

const mariners = buildCustomizedTemplateDraft({
  firstName: "Tyler",
  roleTitle: "Director of Game Entertainment and Experiential Marketing",
  organizationName: "Seattle Mariners",
  opportunityTitle: "Mariners — participatory anthem",
  category: "sports",
});
assert.match(mariners.body, /Seattle Mariners/);
assert.doesNotMatch(mariners.body, /Pacific Northwest Ballet|I've been a 12/);

console.log("custom template drafts ok");
