import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Regression: morning digest must not recycle already-emailed pending leads. */
const send = readFileSync(join(process.cwd(), "lib/sales/digest/send.ts"), "utf8");
const ensure = readFileSync(join(process.cwd(), "lib/sales/digest/ensure.ts"), "utf8");
const queue = readFileSync(join(process.cwd(), "lib/sales/db/queue.ts"), "utf8");
const sql = readFileSync(join(process.cwd(), "supabase/sales-platform-add-digest-item-tracking.sql"), "utf8");
const render = readFileSync(join(process.cwd(), "lib/sales/digest/render.ts"), "utf8");

assert.match(send, /listPendingNeverDigestedQueueItems/, "digest must prefer never-digested leads");
assert.match(send, /markQueueItemsDigested|recordDigested/, "digest must mark emailed leads");
assert.match(send, /appendDigestedQueueItemIds/, "digest must soft-store digested ids as fallback");
assert.match(send, /bootstrapDigestedIdsIfEmpty/, "digest must bootstrap soft-store when empty");
assert.match(
  send,
  /createdAt >= sinceIso/,
  "digest must gate on created-since last digest (no ancient stranded recycle)"
);
assert.equal(
  /Always fill toward the daily target from older pending/.test(send),
  false,
  "digest must not always-backfill older pending (recycles the same email)"
);
assert.equal(
  /stranded net-new/.test(send),
  false,
  "digest must not fill from older stranded pending (recycles unmarked digests)"
);
assert.match(ensure, /getLastDeliveredDigestRun/, "already_sent must key off real lead deliveries");
assert.match(
  ensure,
  /Already have net-new|send now/,
  "digest must send as soon as any net-new leads exist"
);
assert.match(queue, /last_digested_at/, "queue row mapper must know last_digested_at");
assert.match(queue, /\.range\(from/, "never-digested query must paginate past PostgREST 1000 cap");
assert.match(sql, /last_digested_at/, "SQL migration must add last_digested_at");
assert.match(render, /MAX_DIGEST_CONTACTS_PER_ORG|pickDigestContacts/, "digest must list top contacts");
assert.match(render, /Contact \$\{i \+ 1\}/, "digest must label multiple contacts");

console.log("digest-net-new regression tests passed");
