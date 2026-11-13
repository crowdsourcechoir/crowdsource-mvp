import assert from "node:assert/strict";
import {
  countPitchCategories,
  countPitchWork,
  pitchCategoryFrom,
  pitchMatchesCategory,
  pitchMatchesQuery,
  pitchMatchesWork,
  pitchWorkFrom,
} from "./library";

const conference = {
  name: "Conference Pitch: Bellevue",
  title: "Make your next conference undeniable.",
  prompt: "A signature Anthem for a Bellevue conference.",
  href: "/pitch/conference-pitch-bellevue",
  category: "conferences",
  workstream: "premium",
  organizationName: "Visit Bellevue",
};

assert.equal(pitchMatchesQuery(conference, "  anthem "), true);
assert.equal(pitchMatchesQuery(conference, "bellevue"), true);
assert.equal(pitchMatchesQuery(conference, "visit"), true);
assert.equal(pitchMatchesQuery(conference, "premium"), true);
assert.equal(pitchMatchesQuery(conference, "conferences"), true);
assert.equal(pitchMatchesQuery(conference, "rave choir"), false);
assert.equal(pitchMatchesQuery(conference, ""), true);

assert.equal(pitchCategoryFrom("  Conference  "), "conferences");
assert.equal(pitchCategoryFrom("Booking agents"), "booking_agents");
assert.equal(pitchCategoryFrom("nope"), null);
assert.equal(pitchWorkFrom("Partnerships 20%"), "partnership");
assert.equal(pitchWorkFrom("sponsors"), "sponsor");
assert.equal(pitchWorkFrom(""), null);

assert.equal(pitchMatchesCategory("conferences", "all"), true);
assert.equal(pitchMatchesCategory("conferences", "conferences"), true);
assert.equal(pitchMatchesCategory("conferences", "sports"), false);
assert.equal(pitchMatchesCategory(null, "conferences"), false);
assert.equal(pitchMatchesWork("premium", "premium"), true);
assert.equal(pitchMatchesWork(null, "all"), true);
assert.equal(pitchMatchesWork(null, "owned"), false);

assert.equal(countPitchWork(["premium", "premium", null]).premium, 2);
assert.equal(countPitchWork(["premium", null]).all, 2);
assert.equal(countPitchCategories(["conferences", "sports", null]).conferences, 1);
assert.equal(countPitchCategories(["conferences"]).all, 1);

console.log("pitch library tests ok");
