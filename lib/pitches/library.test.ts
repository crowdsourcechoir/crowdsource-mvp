import assert from "node:assert/strict";
import { pitchCategoryNames, pitchInCategory, pitchMatchesQuery } from "./library";

const conference = {
  name: "Conference Pitch: Bellevue",
  title: "Make your next conference undeniable.",
  prompt: "A signature Anthem for a Bellevue conference.",
  href: "/pitch/conference-pitch-bellevue",
  category: "Conference",
  organizationName: "Visit Bellevue",
};

assert.equal(pitchMatchesQuery(conference, "  anthem "), true);
assert.equal(pitchMatchesQuery(conference, "bellevue"), true);
assert.equal(pitchMatchesQuery(conference, "visit"), true);
assert.equal(pitchMatchesQuery(conference, "rave choir"), false);
assert.equal(pitchMatchesQuery(conference, ""), true);

assert.equal(pitchInCategory("Conference", "*"), true);
assert.equal(pitchInCategory("Conference", "conference"), true);
assert.equal(pitchInCategory("Conference", "Partnership"), false);
assert.equal(pitchInCategory(null, "?"), true);
assert.equal(pitchInCategory("Conference", "?"), false);

assert.deepEqual(pitchCategoryNames(["Partnership", "conference", "Conference", null, "  "]), ["conference", "Partnership"]);

console.log("pitch library tests ok");
