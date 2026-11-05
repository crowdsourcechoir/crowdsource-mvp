import assert from "node:assert/strict";
import { classifyHomeCity, topCounts } from "./home-cities";

assert.deepEqual(classifyHomeCity({ city: "Spokane Valley", region: "WA" }), {
  city: "Spokane",
  reason: "spokane",
});
assert.deepEqual(classifyHomeCity({ tags: ["group:boise"] }), { city: "Boise", reason: "boise" });
assert.deepEqual(classifyHomeCity({ city: `"city":"Spokane"`, region: `"state":"WA"` }), {
  city: "Spokane",
  reason: "spokane",
});
assert.deepEqual(classifyHomeCity({ city: "Seattle", tags: ["visited boise once"] }), {
  city: "Boise",
  reason: "boise",
});
assert.deepEqual(classifyHomeCity({ city: "Bellevue", region: "WA", tags: ["newsletter"] }), {
  city: "Seattle",
  reason: "seattle",
});
assert.deepEqual(classifyHomeCity({}), { city: "Seattle", reason: "seattle" });
assert.equal(classifyHomeCity({ city: "Spokane", tags: ["boise"] }).city, "Spokane");
assert.equal(classifyHomeCity({ tags: ["spokane", "boise"], region: "ID" }).city, "Seattle");

assert.deepEqual(topCounts(["", "", "Spokane", "spokane"]), [
  { value: "", count: 2 },
  { value: "spokane", count: 1 },
  { value: "Spokane", count: 1 },
]);

console.log("home city classification ok");
