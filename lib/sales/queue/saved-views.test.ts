import assert from "node:assert/strict";
import { QUEUE_SAVED_VIEWS, matchingSavedView, parseQueueSavedView } from "./saved-views";

function main() {
  assert.equal(QUEUE_SAVED_VIEWS.length, 6);
  assert.equal(parseQueueSavedView("commissioned_revenue"), "commissioned_revenue");
  assert.equal(parseQueueSavedView("nope"), null);

  assert.equal(
    matchingSavedView({
      scope: "all",
      business: "commissioned",
      deal: "all",
      value: "all",
      cash: "all",
    }),
    "commissioned_revenue"
  );
  assert.equal(
    matchingSavedView({
      scope: "all",
      business: "owned",
      deal: "all",
      value: "all",
      cash: "all",
    }),
    "owned_entertainment"
  );
  assert.equal(
    matchingSavedView({
      scope: "all",
      business: "all",
      deal: "sponsorship",
      value: "all",
      cash: "all",
    }),
    "sponsorships"
  );
  assert.equal(
    matchingSavedView({
      scope: "due",
      business: "all",
      deal: "all",
      value: "all",
      cash: "all",
    }),
    "follow_ups"
  );
  assert.equal(
    matchingSavedView({
      scope: "all",
      business: "all",
      deal: "all",
      value: "high",
      cash: "all",
    }),
    "high_value"
  );

  console.log("saved-views tests passed");
}

main();
