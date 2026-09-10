import assert from "node:assert/strict";
import { evaluateSegment, isSendable, personMatchesSegment } from "./segments";
import { parseMailchimpCsv } from "./ingest/mailchimp";
import { renderMarketingEmail } from "./email/render";
import { DEFAULT_MARKETING_SETTINGS, EMPTY_EMAIL_STATS, type MarketingPerson, type MarketingSegment } from "./types";

const basePerson: MarketingPerson = {
  id: "mkt_1",
  email: "a@example.com",
  normalizedEmail: "a@example.com",
  displayName: "Ada",
  city: "Seattle",
  region: null,
  country: null,
  status: "subscribed",
  marketingConsent: true,
  consentAt: new Date().toISOString(),
  consentSource: "test",
  acquisitionSource: "manual",
  acquisitionDetail: null,
  tags: ["newsletter"],
  mailchimpId: null,
  suppressedAt: null,
  bounceClass: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const seattle: MarketingSegment = {
  id: "seg_1",
  name: "Seattle",
  description: null,
  rules: [
    { field: "status", op: "eq", value: "subscribed" },
    { field: "marketingConsent", op: "eq", value: true },
    { field: "city", op: "eq", value: "Seattle" },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

assert.equal(personMatchesSegment(basePerson, seattle), true);
assert.equal(
  personMatchesSegment({ ...basePerson, city: "Portland" }, seattle),
  false
);
assert.equal(isSendable({ ...basePerson, status: "unsubscribed" }), false);
assert.equal(evaluateSegment([basePerson, { ...basePerson, id: "2", city: "Tacoma" }], seattle).length, 1);

const rows = parseMailchimpCsv(`Email,Status,City,Tags
one@example.com,subscribed,Seattle,newsletter
two@example.com,unsubscribed,Seattle,newsletter`);
assert.equal(rows.length, 2);
assert.equal(rows[1]?.status, "unsubscribed");

const rendered = renderMarketingEmail(
  {
    id: "eml_1",
    campaignId: "cmp_1",
    subject: "Hello",
    previewText: "Preview",
    fromName: "CSC",
    fromEmail: "hello@example.com",
    replyTo: null,
    blocks: [
      { id: "1", type: "hero", props: { title: "Crowdsource Choir", subtitle: "Hi" } },
      { id: "2", type: "cta", props: { label: "Go", href: "https://example.com" } },
      { id: "3", type: "footer", props: { companyName: "CSC", physicalAddress: "Seattle" } },
    ],
    segmentId: null,
    status: "draft",
    scheduledFor: null,
    sentAt: null,
    stats: { ...EMPTY_EMAIL_STATS },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    settings: DEFAULT_MARKETING_SETTINGS,
    unsubscribeUrl: "https://example.com/unsub",
    baseUrl: "https://example.com",
  }
);
assert.match(rendered.html, /Crowdsource Choir/);
assert.match(rendered.html, /Unsubscribe/);
assert.equal(rendered.subject, "Hello");

console.log("marketing-v1 tests ok");
