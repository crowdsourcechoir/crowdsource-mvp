import assert from "node:assert/strict";
import { formatQueuePlace, matchesQueuePlace, resolveQueuePlace } from "./place";

const seattle = { locationCity: "Seattle", locationRegion: "WA" };
const bellevue = { locationCity: "Bellevue", locationRegion: "WA" };
const austin = { locationCity: "Austin", locationRegion: "TX" };
const dc = { locationCity: "Washington", locationRegion: "DC" };
const louisiana = { locationCity: "New Orleans", locationRegion: "LA" };
const losAngeles = { locationCity: "Los Angeles", locationRegion: "CA" };
const saintLouis = { locationCity: "Saint Louis", locationRegion: "MO" };
const namedRegion = { locationCity: "Portland", locationRegion: "Oregon" };
const blank = { locationCity: null, locationRegion: null };

assert.equal(matchesQueuePlace(seattle, ""), true);
assert.equal(matchesQueuePlace(seattle, "   "), true);
assert.equal(matchesQueuePlace(blank, "seattle"), false);

assert.equal(matchesQueuePlace(seattle, "seattle"), true);
assert.equal(matchesQueuePlace(seattle, "Seat"), true);
assert.equal(matchesQueuePlace(bellevue, "seattle"), false);
assert.equal(matchesQueuePlace(bellevue, "bellevue"), true);

assert.equal(matchesQueuePlace(seattle, "wa"), true);
assert.equal(matchesQueuePlace(seattle, "WA"), true);
assert.equal(matchesQueuePlace(bellevue, "Washington"), true);
assert.equal(matchesQueuePlace(austin, "washington"), false);
assert.equal(matchesQueuePlace(austin, "tx"), true);
assert.equal(matchesQueuePlace(austin, "Texas"), true);
assert.equal(matchesQueuePlace({ locationCity: "Oakland", locationRegion: "CA" }, "cal"), true);
assert.equal(matchesQueuePlace({ locationCity: "Oakland", locationRegion: "CA" }, "california"), true);
assert.equal(matchesQueuePlace(namedRegion, "or"), true);
assert.equal(matchesQueuePlace(namedRegion, "Oregon"), true);

assert.equal(matchesQueuePlace({ locationCity: "Walla Walla", locationRegion: "WA" }, "wa"), true);
assert.equal(matchesQueuePlace({ locationCity: "Walla Walla", locationRegion: "WA" }, "walla"), true);
assert.equal(matchesQueuePlace({ locationCity: "Honolulu", locationRegion: "HI" }, "wa"), false);

assert.equal(matchesQueuePlace(dc, "dc"), true);
assert.equal(matchesQueuePlace(dc, "washington"), true);
assert.equal(matchesQueuePlace(dc, "wa"), false);
assert.equal(matchesQueuePlace(seattle, "dc"), false);

assert.equal(matchesQueuePlace(losAngeles, "la"), true);
assert.equal(matchesQueuePlace(louisiana, "la"), true);
assert.equal(matchesQueuePlace(losAngeles, "los angeles"), true);
assert.equal(matchesQueuePlace(louisiana, "nola"), true);
assert.equal(matchesQueuePlace({ locationCity: "New York", locationRegion: "NY" }, "nyc"), true);
assert.equal(matchesQueuePlace({ locationCity: "San Francisco", locationRegion: "CA" }, "sf"), true);

assert.equal(matchesQueuePlace(saintLouis, "st louis"), true);
assert.equal(matchesQueuePlace({ locationCity: "St. Louis", locationRegion: "MO" }, "saint louis"), true);

assert.equal(matchesQueuePlace({ locationCity: "Toronto", locationRegion: "ON" }, "ontario"), true);
assert.equal(matchesQueuePlace({ locationCity: "Toronto", locationRegion: "Ontario" }, "on"), true);

assert.deepEqual(
  resolveQueuePlace({
    locationCity: "Seattle",
    locationRegion: "WA",
    importMetadata: { City: "Portland", State: "OR" },
  }),
  { locationCity: "Seattle", locationRegion: "WA" }
);
assert.deepEqual(
  resolveQueuePlace({
    locationCity: null,
    locationRegion: "  ",
    importMetadata: { City: "Austin", State: "TX" },
  }),
  { locationCity: "Austin", locationRegion: "TX" }
);
assert.equal(formatQueuePlace(seattle), "Seattle, WA");
assert.equal(formatQueuePlace({ locationCity: "Dubai", locationRegion: null }), "Dubai");
assert.equal(formatQueuePlace(blank), null);

console.log("queue place search tests passed");
