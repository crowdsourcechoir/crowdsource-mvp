import assert from "node:assert/strict";
import { mergeSearchHits, matchRank, orIlike, sanitizeSearchTerm } from "./query";

async function main() {
  assert.equal(sanitizeSearchTerm("  Seahawks  "), "Seahawks");
  assert.equal(sanitizeSearchTerm('foo%bar_baz,("x")'), "foo bar baz x");
  assert.ok(sanitizeSearchTerm("a".repeat(200)).length <= 80);

  assert.equal(
    orIlike(["name", "email"], "Joel"),
    'name.ilike."%Joel%",email.ilike."%Joel%"'
  );

  assert.ok(matchRank("contact", "Joel DeJong", "joel") > matchRank("contact", "Someone else", "joel"));
  assert.ok(matchRank("organization", "Seattle Seahawks", "seahawks") > 0);

  const hits = mergeSearchHits(
    [
      { organizationId: "org-1", organizationName: "Seahawks", kind: "organization", label: "Organization", rank: 90 },
      { organizationId: "org-1", kind: "contact", label: "John Schneider · GM", rank: 70 },
      { organizationId: "org-2", organizationName: "Other", kind: "contact", label: "Jane", rank: 60 },
    ],
    [
      { id: "org-1", name: "Seattle Seahawks", websiteUrl: "https://seahawks.com" },
      { id: "org-2", name: "Other Choir", websiteUrl: null },
    ],
    new Map([["org-1", { queueItemId: "q1", opportunityTitle: "Seahawks 2026" }]])
  );

  assert.equal(hits.length, 2);
  assert.equal(hits[0].organizationName, "Seattle Seahawks");
  assert.equal(hits[0].queueItemId, "q1");
  assert.equal(hits[0].kind, "organization");
  assert.equal(hits[1].organizationName, "Other Choir");
  assert.equal(hits[1].queueItemId, null);

  console.log("sales search query tests passed");
}

void main();
