import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Regression: Find more / Add contact / select-contact must not refuse decided queue rows. */
async function main() {
  const findMore = readFileSync(join(process.cwd(), "lib/sales/seed/find-more-contacts.ts"), "utf8");
  const addManual = readFileSync(join(process.cwd(), "lib/sales/seed/add-manual.ts"), "utf8");
  const selectContact = readFileSync(
    join(process.cwd(), "app/api/sales/queue/[itemId]/select-contact/route.ts"),
    "utf8"
  );
  const saveDraft = readFileSync(join(process.cwd(), "app/api/sales/queue/[itemId]/save-draft/route.ts"), "utf8");

  assert.equal(
    /throw new Error\(["']Queue item already decided/.test(findMore),
    false,
    "find-more-contacts must not throw Queue item already decided"
  );
  assert.equal(
    /throw new Error\(["']Queue item already decided/.test(addManual),
    false,
    "add-manual must not throw Queue item already decided"
  );
  assert.match(findMore, /wasDecided/);
  assert.match(findMore, /reopenDecided:\s*true/);
  assert.match(addManual, /wasDecided/);
  assert.match(addManual, /reopenDecided:\s*true/);
  assert.match(findMore, /parseContactPaste/, "find-more must detect pasted Name: email lists");
  assert.match(findMore, /addPastedContactsForQueueItem/, "find-more must add pasted contacts with titles");
  assert.equal(
    /verified\.status !== ["']verified_deliverable["']/.test(findMore),
    false,
    "find-more must not require verified_deliverable"
  );
  assert.equal(
    /could not confirm deliverability/.test(addManual),
    false,
    "add-manual must not refuse accept_all / risky"
  );
  assert.match(findMore, /MAX_RESULTS_PER_MANUAL_SEARCH\s*=\s*10/, "manual find-more may take a full Domain Search page");
  assert.match(findMore, /MAX_RESULTS_PER_AUTOMATED_SEARCH\s*=\s*3/, "automated find-more stays at top 3");
  assert.match(findMore, /mode === ["']automated["']/, "per-org budget must gate on automated mode only");
  assert.match(findMore, /hunterContactSlotsRemaining/, "automated path still uses per-org contact slots");
  assert.match(findMore, /hunterCreditBudgetRemaining/, "automated path still uses per-org credit budget");
  assert.match(
    findMore,
    /mode === ["']automated["'] && \(slotsLeft <= 0 \|\| creditBudget < 1\)/,
    "cap early-return must require automated mode"
  );
  assert.match(
    readFileSync(join(process.cwd(), "app/api/sales/queue/[itemId]/find-contacts/route.ts"), "utf8"),
    /mode:\s*["']manual["']/,
    "queue Find more API must call find-more in manual mode"
  );
  assert.match(findMore, /pickTopHunterPeople/, "find-more must rank by seniority before adding");
  console.log("find-more-contacts decided-item regression tests passed");
}

void main();
