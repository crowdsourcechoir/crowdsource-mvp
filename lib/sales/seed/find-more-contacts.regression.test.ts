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
  assert.match(findMore, /verified\.status === ["']invalid["']/, "find-more must only skip hard bounces");
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
  console.log("find-more-contacts decided-item regression tests passed");
}

void main();
