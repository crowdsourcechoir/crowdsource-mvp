import assert from "node:assert/strict";
import { searchHunterDomain } from "./hunter-domain-search";

async function main() {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.HUNTER_API_KEY;

  process.env.HUNTER_API_KEY = "";
  const missing = await searchHunterDomain({ domain: "mopop.org" });
  assert.equal(missing.ok, false);
  assert.match(missing.error ?? "", /HUNTER_API_KEY/);

  process.env.HUNTER_API_KEY = "test-key";
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    assert.match(url, /api\.hunter\.io\/v2\/domain-search/);
    assert.match(url, /domain=mopop\.org/);
    assert.match(url, /job_titles=events%2Cevent/);
    assert.match(url, /type=personal/);
    assert.match(url, /required_field=full_name/);
    return new Response(
      JSON.stringify({
        data: {
          emails: [
            {
              value: "patlee@mopop.org",
              type: "personal",
              confidence: 91,
              first_name: "Pat",
              last_name: "Lee",
              position: "Director of Events",
              seniority: "senior",
              department: "operations",
              linkedin: null,
              phone_number: null,
              verification: { status: "valid" },
            },
          ],
        },
        meta: { results: 1 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  const found = await searchHunterDomain({
    domain: "mopop.org",
    type: "personal",
    requiredFields: ["full_name"],
    jobTitles: ["events", "event"],
  });
  assert.equal(found.ok, true);
  assert.equal(found.people.length, 1);
  assert.equal(found.people[0].email, "patlee@mopop.org");
  assert.equal(found.people[0].firstName, "Pat");
  assert.equal(found.people[0].position, "Director of Events");
  assert.equal(calls.length, 1);

  process.env.HUNTER_API_KEY = originalKey;
  globalThis.fetch = originalFetch;
  console.log("hunter-domain-search tests passed");
}

void main();
