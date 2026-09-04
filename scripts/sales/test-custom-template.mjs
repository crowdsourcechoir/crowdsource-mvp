import assert from "node:assert/strict";
import { buildCustomizedTemplateDraft } from "../../lib/sales/outreach/custom-template.ts";
import { looksLikeGenericTemplateDraft, draftNeedsTemplateRedraft } from "../../lib/sales/outreach/customize-draft.ts";

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
assert.match(nahq.body, /^- A shared anthem/m);
assert.doesNotMatch(nahq.body, /Seahawks|Pacific Northwest Ballet|I thought it might be a unique fit|the the /);
assert.equal(looksLikeGenericTemplateDraft(nahq.body), false);
assert.equal(draftNeedsTemplateRedraft("With Mariners — ballpark ritual", "Crowdsourcing a Seattle Mariners choir"), true);
assert.equal(
  draftNeedsTemplateRedraft(
    "With Seattle Mariners, I see a few connected possibilities:\n\nI'd love to connect and explore whether there's a fit with Seattle Mariners — or be pointed to the right person.",
    "Crowdsourcing a Seattle Mariners choir"
  ),
  false
);
assert.equal(draftNeedsTemplateRedraft(nahq.body, nahq.subject), false);

const mariners = buildCustomizedTemplateDraft({
  firstName: "Tyler",
  roleTitle: "Director of Game Entertainment and Experiential Marketing",
  organizationName: "Seattle Mariners",
  opportunityTitle: "Mariners — ballpark ritual / shared-creation anthem",
  category: "sports",
});
assert.match(mariners.body, /With Seattle Mariners/);
assert.match(mariners.body, /^- A participatory music experience/m);
assert.doesNotMatch(mariners.body, /Pacific Northwest Ballet|I've been a 12|ballpark ritual/);

const msae = buildCustomizedTemplateDraft({
  firstName: "Donna",
  roleTitle: "President & CEO",
  organizationName: "Michigan Society of Association Executives",
  opportunityTitle: "participatory anthem for the annual conference",
  category: "conferences",
});
assert.match(msae.subject, /Michigan Society of Association Executives/);
assert.match(msae.body, /Michigan Society of Association Executives/);
assert.doesNotMatch(msae.body, /the the /);
assert.doesNotMatch(msae.subject, /\+ the annual /);

const inbox = buildCustomizedTemplateDraft({
  firstName: "there",
  roleTitle: "General inbox",
  organizationName: "Fred Hutch Cancer Center",
  opportunityTitle: "Crowdsource Choir + Fred Hutch Cancer Center",
  category: "fundraisers",
});
assert.match(inbox.body, /Hi there,/);
assert.match(inbox.subject, /Fred Hutch/);
assert.doesNotMatch(inbox.body, /Hi Events/);

console.log("custom template drafts ok");
