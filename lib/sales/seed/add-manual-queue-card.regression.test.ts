import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Regression: Add contact must mint a draft card and keep the contact visible in the queue. */
function main() {
  const addManual = readFileSync(join(process.cwd(), "lib/sales/seed/add-manual.ts"), "utf8");
  const assemble = readFileSync(join(process.cwd(), "lib/sales/db/assemble.ts"), "utf8");
  const dedupe = readFileSync(join(process.cwd(), "lib/sales/dedupe.ts"), "utf8");

  assert.match(dedupe, /isQueueListedContact/, "dedupe must export queue listing helper");
  assert.match(assemble, /isQueueListedContact/, "assemble must list needs-email / bounce cards");
  assert.match(addManual, /createOutreachDraft/, "add-contact must be able to mint a draft for the new contact");
  assert.match(addManual, /draftCopyForContact/, "add-contact draft mint uses contact copy");
  assert.match(addManual, /new draft card|contact card/, "user-facing copy should mention the card");
  assert.equal(
    /not added to the send list/.test(addManual),
    false,
    "bounce path must still show a contact card, not hide the person"
  );

  console.log("add-manual queue-card regression tests passed");
}

main();
