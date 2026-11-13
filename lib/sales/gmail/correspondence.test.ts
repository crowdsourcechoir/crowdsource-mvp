import assert from "node:assert/strict";
import { gmailCorrespondenceQuery } from "./correspondence";

const query = gmailCorrespondenceQuery([
  " Celestina@VisitBellevue.com ",
  "chendrickson@visitbellevue.com",
  "not-an-email",
  "BJones@visitbellevue.com",
]);

assert.ok(query);
assert.match(query!, /from:chendrickson@visitbellevue.com/);
assert.match(query!, /to:bjones@visitbellevue.com/);
assert.match(query!, /cc:chendrickson@visitbellevue.com/);
assert.equal((query!.match(/chendrickson@visitbellevue.com/g) ?? []).length, 3);
assert.ok(query!.includes("-in:chats"));
assert.equal(gmailCorrespondenceQuery(["", "nope"]), null);

console.log("correspondence.test.ts: ok");
