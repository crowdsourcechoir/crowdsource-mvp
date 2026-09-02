/**
 * Queue category filters.
 * Run: npx tsx scripts/sales/test-queue-category.mjs
 */
import assert from "node:assert/strict";
import {
  classifyQueueCategory,
  countQueueCategories,
  matchesQueueCategory,
  parseQueueCategory,
} from "../../lib/sales/queue/category.ts";

assert.equal(parseQueueCategory(null), "all");
assert.equal(parseQueueCategory("fundraisers"), "fundraisers");
assert.equal(parseQueueCategory("nope"), "all");

assert.equal(
  classifyQueueCategory({
    organizationName: "Seattle Seahawks",
    opportunityTitle: "Song Garden / shared-creation anthem",
    opportunityTypeKey: "fan_engagement_initiative",
    organizationTypeKey: "sports_team",
  }),
  "sports"
);

assert.equal(
  classifyQueueCategory({
    organizationName: "Florida Hospital Association",
    opportunityTitle: "FHA Annual Meeting — participatory anthem",
    opportunityTypeKey: "annual_conference",
    organizationTypeKey: "association",
  }),
  "conferences"
);

assert.equal(
  classifyQueueCategory({
    organizationName: "Robin Hood Foundation",
    opportunityTitle: "Robin Hood Benefit — participatory anthem",
    opportunityTypeKey: "fundraising_gala",
    organizationTypeKey: "nonprofit",
  }),
  "fundraisers"
);

assert.equal(
  classifyQueueCategory({
    organizationName: "Wedgwood Circle",
    opportunityTitle: "Play — The 2026 Wedgwood Circle Annual Event",
    opportunityTypeKey: "annual_conference",
    organizationTypeKey: "nonprofit",
    salesInitiative: "arts_culture",
  }),
  "arts"
);

assert.equal(
  classifyQueueCategory({
    organizationName: "ETHDenver",
    opportunityTitle: "ETHDenver — participatory anthem",
    opportunityTypeKey: "annual_conference",
    organizationTypeKey: "conference",
  }),
  "tech"
);

assert.equal(
  classifyQueueCategory({
    organizationName: "National Academy of Television Arts & Sciences",
    opportunityTitle: "NATAS — Emmy weekend",
    opportunityTypeKey: "annual_conference",
    organizationTypeKey: "association",
  }),
  "entertainment"
);

assert.equal(
  classifyQueueCategory({
    organizationName: "Oregon State University Athletics",
    opportunityTitle: "Turn Beaver fans into the game-day show",
    opportunityTypeKey: "fan_engagement_initiative",
    organizationTypeKey: "university",
  }),
  "sports"
);

assert.equal(
  classifyQueueCategory({
    organizationName: "SpaceX",
    opportunityTitle: "SpaceX launch / campus gathering — developer conference",
    opportunityTypeKey: "annual_conference",
  }),
  "tech"
);

assert.equal(
  classifyQueueCategory({
    organizationName: "SEMA Show",
    opportunityTitle: "SEMA Show — auto show",
    opportunityTypeKey: "annual_conference",
  }),
  "entertainment"
);

assert.equal(
  classifyQueueCategory({
    organizationName: "Pacific Science Center",
    opportunityTitle: "Pacific Science Center installation",
    organizationTypeKey: "nonprofit",
  }),
  "arts"
);

assert.equal(
  matchesQueueCategory({ category: "arts", organizationName: "Wedgwood Circle" }, "arts"),
  true
);
assert.equal(
  matchesQueueCategory({ category: "arts", organizationName: "Wedgwood Circle" }, "sports"),
  false
);
assert.equal(matchesQueueCategory({ category: "arts" }, "all"), true);

const counts = countQueueCategories([
  { organizationName: "Seahawks", opportunityTypeKey: "fan_engagement_initiative" },
  { organizationName: "FHA", opportunityTypeKey: "annual_conference" },
  { organizationName: "Robin Hood", opportunityTypeKey: "fundraising_gala" },
]);
assert.equal(counts.all, 3);
assert.equal(counts.sports, 1);
assert.equal(counts.conferences, 1);
assert.equal(counts.fundraisers, 1);

console.log("queue category filters ok");
