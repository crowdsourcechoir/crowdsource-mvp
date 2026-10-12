import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression: after send auto-advances to the next contact card, the draft editor
 * must reload that contact's subject/body (not keep the just-sent greeting).
 */
function main() {
  const client = readFileSync(
    join(process.cwd(), "components/sales/ApprovalQueueClient.tsx"),
    "utf8"
  );
  assert.match(client, /draftIdentityRef\.current = ""/, "post-send must reset draft identity");
  assert.match(client, /key=\{draftIdentity\}/, "editor must remount when draft/contact changes");
  assert.match(client, /draftId/, "persist must send draftId so save-draft can reject stale blurs");
  assert.match(
    client,
    /useEffect\(\(\) => \{\n    if \(draftIdentityRef\.current === draftIdentity\) return;/,
    "draft subject/body sync must run in useEffect, not during render"
  );

  const assemble = readFileSync(join(process.cwd(), "lib/sales/db/assemble.ts"), "utf8");
  assert.match(assemble, /pickQueueActiveContact/, "queue detail must prefer draft contact");
  assert.match(
    assemble,
    /pickQueueActiveContact\(contactsList, draft\?\.contactId\)/,
    "buildDetail must use pickQueueActiveContact"
  );

  console.log("draft-advance-sync tests passed");
}

main();
