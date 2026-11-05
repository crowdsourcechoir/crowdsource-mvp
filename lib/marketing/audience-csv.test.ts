// node --experimental-strip-types --import ./scripts/marketing/register-strip-types.mjs lib/marketing/audience-csv.test.ts
import assert from "node:assert/strict";
import { audienceToCsv } from "./audience-csv";
import type { MarketingPerson } from "./types";

const person: MarketingPerson = {
  id: "p1",
  email: "ada@example.com",
  normalizedEmail: "ada@example.com",
  displayName: "Ada, Lovelace",
  city: "Seattle",
  region: "WA",
  country: "USA",
  status: "subscribed",
  marketingConsent: true,
  consentAt: null,
  consentSource: null,
  acquisitionSource: "mailchimp",
  acquisitionDetail: null,
  tags: ["newsletter", "group:shows"],
  mailchimpId: null,
  suppressionReasons: [],
  suppressedAt: null,
  bounceClass: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const csv = audienceToCsv([person]);
assert.match(csv, /^Email,Name,City,State,Country,Status,Tags,Source\n/);
assert.match(csv, /"Ada, Lovelace"/);
assert.match(csv, /newsletter, group:shows/);
assert.match(csv, /mailchimp/);
assert.equal(audienceToCsv([]), "Email,Name,City,State,Country,Status,Tags,Source\n");

console.log("audience csv tests ok");
