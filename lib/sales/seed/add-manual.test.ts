import assert from "node:assert/strict";
import { parseManualContactInput, splitPersonName } from "./add-manual";
import { activeSearchProvider, runSearch, SEARCH_DISABLED_REASON } from "../discovery/search";

async function main() {
  assert.deepEqual(splitPersonName("Joel DeJong"), { firstName: "Joel", lastName: "DeJong" });
  assert.deepEqual(splitPersonName("  Mary Ann Smith "), { firstName: "Mary", lastName: "Ann Smith" });
  assert.equal(splitPersonName("Joel"), null);
  assert.equal(splitPersonName(""), null);

  assert.deepEqual(parseManualContactInput("events@fredhutch.org", null), {
    displayName: "Events inbox",
    email: "events@fredhutch.org",
    isGenericMailbox: true,
  });
  assert.deepEqual(parseManualContactInput("", "info@org.org"), {
    displayName: "Info inbox",
    email: "info@org.org",
    isGenericMailbox: true,
  });
  assert.deepEqual(parseManualContactInput("Events Contact", "events@fredhutch.org"), {
    displayName: "Events Contact",
    email: "events@fredhutch.org",
    isGenericMailbox: true,
  });
  assert.deepEqual(parseManualContactInput("Thomas Sheehan", "tsheehan@fredhutch.org"), {
    displayName: "Thomas Sheehan",
    email: "tsheehan@fredhutch.org",
    isGenericMailbox: false,
  });
  assert.throws(() => parseManualContactInput("Events Contact", null), /inbox email/);
  assert.throws(() => parseManualContactInput("Thomas", null), /first and last name/);

  assert.equal(activeSearchProvider(), null);
  assert.equal(await runSearch("anything"), null);
  assert.ok(SEARCH_DISABLED_REASON.toLowerCase().includes("hunter"));

  process.env.TAVILY_API_KEY = "should-be-ignored";
  process.env.SERPER_API_KEY = "should-be-ignored";
  assert.equal(activeSearchProvider(), null, "Tavily env must not enable web search");

  console.log("add-manual / search-disabled tests passed");
}

void main();
