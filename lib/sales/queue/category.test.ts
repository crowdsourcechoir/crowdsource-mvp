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

  assert.equal(
    classifyQueueCategory({ salesInitiative: "booking_agents", organizationName: "WSB" }),
    "booking_agents"
  );
  assert.equal(
    classifyQueueCategory({ organizationName: "Premiere Speakers Bureau" }),
    "booking_agents"
  );

  const counts = countQueueCategories([
    { salesInitiative: "wfea_network", organizationName: "A" },
    { salesInitiative: "sports_fan_culture", organizationName: "B" },
    { salesInitiative: "booking_agents", organizationName: "C" },
  ]);
  assert.equal(counts.other, 1);
  assert.equal(counts.sports, 1);
  assert.equal(counts.booking_agents, 1);
  assert.equal(counts.sponsors, 0);
  assert.equal(counts.all, 3);
  assert.equal(
    classifyQueueCategory({ salesInitiative: "sponsor_partners", organizationName: "Kaiser Permanente" }),
    "sponsors"
  );

  console.log("queue/category tests passed");
}

main();
