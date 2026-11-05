import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Regression: queue contact cards must expose Edit → PATCH that can fix mistyped emails. */
function main() {
  const route = readFileSync(join(process.cwd(), "app/api/sales/contacts/[contactId]/route.ts"), "utf8");
  const update = readFileSync(join(process.cwd(), "lib/sales/seed/update-contact.ts"), "utf8");
  const form = readFileSync(join(process.cwd(), "components/sales/EditContactForm.tsx"), "utf8");
  const queue = readFileSync(join(process.cwd(), "components/sales/ApprovalQueueClient.tsx"), "utf8");
  const dedupe = readFileSync(join(process.cwd(), "lib/sales/dedupe.ts"), "utf8");

  assert.match(route, /export async function PATCH/, "contacts API must support PATCH");
  assert.match(route, /updateQueueContact/, "PATCH must call updateQueueContact");
  assert.match(update, /verifyEmailAddress/, "email changes must re-verify");
  assert.match(update, /ensureContactDrafts|createOutreachDraft/, "sendable edits must keep a draft");
  assert.match(form, /method: "PATCH"/, "EditContactForm must PATCH the contact");
  assert.match(form, /normalizeEmail/, "edit form prefills a cleaned email");
  assert.match(queue, /EditContactForm/, "queue cards must mount EditContactForm");
  assert.match(queue, /Edit/, "queue cards must show an Edit control");
  assert.match(dedupe, /\[.,;:>/, "normalizeEmail must strip trailing punctuation");

  console.log("update-contact regression tests passed");
}

main();
