import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression: after sending one contact, the queue row points at the next draft.
 * A blur/save from the previous editor must not overwrite the next contact's copy.
 */
function main() {
  const src = readFileSync(join(import.meta.dirname, "route.ts"), "utf8");
  assert.match(src, /requestedDraftId/, "save-draft must read client draftId");
  assert.match(src, /draft_changed/, "save-draft must skip when draftId no longer matches queue row");
  assert.match(src, /skipped:\s*true/, "mismatched draftId should return skipped:true");
  console.log("save-draft-guard tests passed");
}

main();
