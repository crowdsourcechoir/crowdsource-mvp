import assert from "node:assert/strict";
import { splitPersonName } from "./add-manual";
import { activeSearchProvider, runSearch, SEARCH_DISABLED_REASON } from "../discovery/search";

async function main() {
  assert.deepEqual(splitPersonName("Joel DeJong"), { firstName: "Joel", lastName: "DeJong" });
  assert.deepEqual(splitPersonName("  Mary Ann Smith "), { firstName: "Mary", lastName: "Ann Smith" });
  assert.equal(splitPersonName("Joel"), null);
  assert.equal(splitPersonName(""), null);

  assert.equal(activeSearchProvider(), null);
  assert.equal(await runSearch("anything"), null);
  assert.ok(SEARCH_DISABLED_REASON.toLowerCase().includes("hunter"));

  process.env.TAVILY_API_KEY = "should-be-ignored";
  process.env.SERPER_API_KEY = "should-be-ignored";
  assert.equal(activeSearchProvider(), null, "Tavily env must not enable web search");

  console.log("add-manual / search-disabled tests passed");
}

void main();
