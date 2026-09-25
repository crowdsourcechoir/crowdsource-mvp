// node --experimental-strip-types --import ./scripts/marketing/register-strip-types.mjs lib/marketing/foundation.test.ts
import assert from "node:assert/strict";
import { decideRootAuth } from "./auth-decision";
import { decideConsent, isMarketingEligible, presentationStatus } from "./consent";
import { legacyBlocksToDocument, documentToLegacyBlocks, migrateEmailDocument } from "./document/migrate";
import { compileSegmentDefinition } from "./segments/compile";
import { definitionToRules, rulesToDefinition } from "./segments/rules";
import { parseMailchimpCsv } from "./ingest/mailchimp";
import type { EmailBlock } from "./types";

const blocks: EmailBlock[] = [
  { id: "blk_hero", type: "hero", props: { title: "Hello", subtitle: "There", imageUrl: "https://cdn.example/a.jpg" } },
  { id: "blk_body", type: "rich_text", props: { text: "Line one\n\nLine <two>", html: "<p>ignored</p>" } },
  { id: "blk_img", type: "image", props: { imageUrl: "https://cdn.example/b.jpg", alt: "Cover", href: "https://example.com" } },
  { id: "blk_cta", type: "cta", props: { label: "Go", href: "https://example.com/go" } },
  { id: "blk_div", type: "divider", props: {} },
  { id: "blk_event", type: "event", props: { eventId: "evt_1", title: "Bloom", url: "https://example.com/e/bloom", ctaText: "Open" } },
  { id: "blk_footer", type: "footer", props: { companyName: "CSC", physicalAddress: "Seattle" } },
];

const document = legacyBlocksToDocument(blocks, "design-system-1", "Weekly");
const roundTrip = documentToLegacyBlocks(document);
assert.equal(roundTrip.length, blocks.length);
assert.equal(roundTrip[0]?.props.title, "Hello");
assert.equal(roundTrip[1]?.props.text, "Line one\n\nLine <two>");
assert.match(String(roundTrip[1]?.props.html), /&lt;two&gt;/);
assert.equal(roundTrip[2]?.props.alt, "Cover");
assert.equal(roundTrip[5]?.props.eventId, "evt_1");
assert.equal(roundTrip[6]?.props.physicalAddress, "Seattle");
assert.throws(() => migrateEmailDocument({ schemaVersion: 2, sections: [] }), /schemaVersion/);

const seattle = rulesToDefinition([
  { field: "status", op: "eq", value: "subscribed" },
  { field: "marketingConsent", op: "eq", value: true },
  { field: "city", op: "eq", value: "Seattle" },
  { field: "tag", op: "eq", value: "conference" },
]);
assert.equal(seattle.ok, true);
if (seattle.ok) {
  const compiled = compileSegmentDefinition(seattle.definition, { sendableOnly: true });
  assert.equal(compiled.ok, true);
  if (compiled.ok) {
    assert.match(compiled.sql, /p\.city/);
    assert.match(compiled.sql, /person_tags/);
    assert.match(compiled.sql, /communication_subscriptions/);
    assert.match(compiled.sql, /email_marketing_eligible/);
    assert.deepEqual(compiled.values, ["subscribed", "Seattle", "conference"]);
  }
  const rules = definitionToRules(seattle.definition);
  assert.equal(rules.some((rule) => rule.field === "city" && rule.value === "Seattle"), true);
}

const behavior = compileSegmentDefinition({
  schemaVersion: 1,
  match: "all",
  conditions: [{ type: "behavior", sendId: "x", signal: "recorded_open", op: "none" }],
});
assert.equal(behavior.ok, false);

const cleaned = rulesToDefinition([{ field: "status", op: "eq", value: "cleaned" }]);
assert.equal(cleaned.ok, false);

assert.equal(compileSegmentDefinition({ schemaVersion: 1, match: "any", conditions: [] }).ok, false);

assert.equal(
  isMarketingEligible({ status: "unsubscribed", activeReasons: [] }),
  false
);
assert.equal(isMarketingEligible({ status: "pending", activeReasons: [] }), false);
assert.equal(isMarketingEligible({ status: "subscribed", activeReasons: ["hard_bounce"] }), false);
assert.equal(isMarketingEligible({ status: "subscribed", activeReasons: ["complaint"] }), false);
assert.equal(isMarketingEligible({ status: "subscribed", activeReasons: [] }), true);
assert.equal(presentationStatus({ status: "subscribed", activeReasons: ["hard_bounce"] }), "cleaned");

const first = decideConsent({
  requested: "unsubscribed",
  respectSuppression: true,
  existing: null,
});
assert.deepEqual(first.ensure, ["unsubscribe"]);
const second = decideConsent({
  requested: "subscribed",
  respectSuppression: true,
  existing: { status: "unsubscribed", activeReasons: ["unsubscribe"] },
});
assert.equal(second.skippedReason, "Preserved unsubscribed status");
assert.equal(second.status, "unsubscribed");

const bounce = decideConsent({
  requested: "subscribed",
  respectSuppression: false,
  existing: { status: "unsubscribed", activeReasons: ["hard_bounce"] },
});
assert.equal(bounce.skippedReason, "Preserved hard bounce");
assert.equal(bounce.liftUnsubscribe, false);

const relift = decideConsent({
  requested: "subscribed",
  respectSuppression: false,
  existing: { status: "unsubscribed", activeReasons: ["unsubscribe"] },
});
assert.equal(relift.liftUnsubscribe, true);
assert.equal(relift.status, "subscribed");
assert.equal(relift.skippedReason, undefined);

const rows = parseMailchimpCsv(`Email,Status,City,Tags
one@example.com,subscribed,Seattle,newsletter
two@example.com,unsubscribed,Seattle,newsletter`);
assert.equal(rows[1]?.status, "unsubscribed");

assert.equal(decideRootAuth({ passwordConfigured: true, token: undefined, expected: "abc" }), "unauthorized");
assert.equal(decideRootAuth({ passwordConfigured: false, token: undefined, expected: null }), "allow");
assert.equal(decideRootAuth({ passwordConfigured: true, token: "secret", expected: "secret" }), "allow");

console.log("marketing foundation tests ok");
