import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Regression: morning digest must not recycle already-emailed pending leads. */
const send = readFileSync(join(process.cwd(), "lib/sales/digest/send.ts"), "utf8");
const queue = readFileSync(join(process.cwd(), "lib/sales/db/queue.ts"), "utf8");
const sql = readFileSync(join(process.cwd(), "supabase/sales-platform-add-digest-item-tracking.sql"), "utf8");

assert.match(send, /listPendingNeverDigestedQueueItems/, "digest must prefer never-digested leads");
assert.match(send, /markQueueItemsDigested|recordDigested/, "digest must mark emailed leads");
assert.match(send, /appendDigestedQueueItemIds/, "digest must soft-store digested ids as fallback");
assert.equal(
  /Always fill toward the daily target from older pending/.test(send),
  false,
  "digest must not always-backfill older pending (recycles the same email)"
);
assert.match(queue, /last_digested_at/, "queue row mapper must know last_digested_at");
assert.match(sql, /last_digested_at/, "SQL migration must add last_digested_at");

console.log("digest-net-new regression tests passed");
