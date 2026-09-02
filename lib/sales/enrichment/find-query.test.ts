import assert from "node:assert/strict";
import { hunterPersonMatchesQuery, parseFindQuery } from "./find-query";

async function main() {
  const events = parseFindQuery("find contacts on the events team");
  assert.ok(events.jobTitles.includes("events"));
  assert.ok(events.jobTitles.includes("event"));
  assert.ok(events.keywords.includes("events"));
  assert.equal(events.departments.length, 0);
  assert.equal(events.seniority.length, 0);

  const marketing = parseFindQuery("marketing");
  assert.ok(marketing.departments.includes("marketing"));

  const development = parseFindQuery("director of development");
  assert.ok(development.jobTitles.includes("development"));
  assert.ok(development.jobTitles.includes("fundraising"));
  assert.ok(development.seniority.includes("senior"));

  const it = parseFindQuery("IT director");
  assert.ok(it.departments.includes("it"));
  assert.ok(it.seniority.includes("senior"));

  const fillerOnly = parseFindQuery("find more contacts");
  assert.deepEqual(fillerOnly.keywords, []);
  assert.deepEqual(fillerOnly.jobTitles, []);

  const eventManager = {
    firstName: "Pat",
    lastName: "Lee",
    position: "Event Manager",
    department: "operations",
    seniority: "senior",
  };
  assert.equal(hunterPersonMatchesQuery(eventManager, events), true);

  const itPerson = {
    firstName: "Sam",
    lastName: "Kim",
    position: "Director of Information Technology",
    department: "it",
    seniority: "executive",
  };
  assert.equal(hunterPersonMatchesQuery(itPerson, events), false);
  assert.equal(hunterPersonMatchesQuery(itPerson, it), true);

  assert.equal(
    hunterPersonMatchesQuery({ position: "Director of Special Events" }, parseFindQuery("events team")),
    true
  );

  console.log("find-query tests passed");
}

void main();
