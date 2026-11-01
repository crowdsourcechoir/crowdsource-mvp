import assert from "node:assert/strict";
import {
  classifyQueueCategory,
  countQueueCategories,
  parseQueueCategory,
} from "./category";

function main() {
  assert.equal(parseQueueCategory("other"), "other");
  assert.equal(parseQueueCategory("nope"), "all");

  assert.equal(
    classifyQueueCategory({ salesInitiative: "wfea_network", organizationName: "Anything Festival" }),
    "other"
  );
  assert.equal(
    classifyQueueCategory({ organizationTypeKey: "other", organizationName: "Vendor Co" }),
    "other"
  );
  assert.equal(
    classifyQueueCategory({ organizationName: "Western Festival & Event Association" }),
    "other"
  );

  const counts = countQueueCategories([
    { salesInitiative: "wfea_network", organizationName: "A" },
    { salesInitiative: "sports_fan_culture", organizationName: "B" },
  ]);
  assert.equal(counts.other, 1);
  assert.equal(counts.sports, 1);
  assert.equal(counts.all, 2);

  console.log("queue/category tests passed");
}

main();
