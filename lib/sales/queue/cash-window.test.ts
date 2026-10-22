import assert from "node:assert/strict";
import {
  addDaysDateOnly,
  eventInCashNowWindow,
  matchesCashNow,
  matchesQueueCashWindow,
  parseQueueCashWindow,
} from "./cash-window";

function main() {
  assert.equal(parseQueueCashWindow("now"), "cash_now");
  assert.equal(parseQueueCashWindow("cash_now"), "cash_now");
  assert.equal(parseQueueCashWindow(null), "all");

  const today = "2026-10-22";
  assert.equal(eventInCashNowWindow("2026-10-22", today), true);
  assert.equal(eventInCashNowWindow(addDaysDateOnly(today, 90), today), true);
  assert.equal(eventInCashNowWindow(addDaysDateOnly(today, 91), today), false);
  assert.equal(eventInCashNowWindow("2026-10-21", today), false);

  assert.equal(matchesCashNow({ relationshipStage: "interest" }, today), true);
  assert.equal(matchesCashNow({ followUpDue: true }, today), true);
  assert.equal(matchesCashNow({ relationshipStage: "awareness" }, today), false);
  assert.equal(matchesQueueCashWindow({ relationshipStage: "lost" }, "all"), true);

  console.log("cash-window.test.ts: ok");
}

main();
