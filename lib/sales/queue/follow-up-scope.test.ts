import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isNudgeFollowUp, mergeFollowUpQueueItems } from "./follow-up-scope";

function main() {
  assert.equal(isNudgeFollowUp({ kind: "nudge" }), true);
  assert.equal(isNudgeFollowUp({ kind: "initial" }), false);
  assert.equal(isNudgeFollowUp({ kind: null }), false);

  const followUps = [
    { id: "reply-1", kind: "initial" },
    { id: "shared", kind: "nudge" },
  ];
  const nudges = [
    { id: "shared", kind: "nudge" },
    { id: "nudge-2", kind: "nudge" },
    { id: "not-a-nudge", kind: "initial" },
  ];
  const merged = mergeFollowUpQueueItems(followUps, nudges);
  assert.deepEqual(
    merged.map((item) => item.id),
    ["reply-1", "shared", "nudge-2"],
    "Follow-ups include scheduled rows and every distinct nudge"
  );

  const queue = readFileSync(join(import.meta.dirname, "../db/queue.ts"), "utf8");
  const dueStart = queue.indexOf('if (scope === "due")');
  assert.ok(dueStart >= 0, "due scope branch should exist");
  const dueBody = queue.slice(dueStart, queue.indexOf("const items = await listQueueItems", dueStart));
  assert.match(dueBody, /listQueueItems\("pending", "nudge"\)/);
  assert.match(dueBody, /mergeFollowUpQueueItems/);
  assert.doesNotMatch(dueBody, /if \(ids\.length === 0\) return \[\]/);

  const client = readFileSync(
    join(process.cwd(), "components/sales/ApprovalQueueClient.tsx"),
    "utf8"
  );
  const draftStart = client.indexOf("const draftNudge = useCallback");
  assert.ok(draftStart >= 0);
  const draftBody = client.slice(draftStart, client.indexOf("const markContactVerified", draftStart));
  assert.match(draftBody, /params\.set\("scope", "due"\)/);
  assert.doesNotMatch(draftBody, /params\.delete\("scope"\)/);

  console.log("follow-up scope tests passed");
}

main();
