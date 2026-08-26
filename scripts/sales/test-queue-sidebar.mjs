/**
 * Queue list helpers + Cloudflare HTML sanitizer.
 * Run: npx tsx scripts/sales/test-queue-sidebar.mjs
 */
import assert from "node:assert/strict";
import { publicErrorMessage, apiErrorFromBody } from "../../lib/sales/http-error.ts";
import { queueSidebarSortScore, sortQueueSidebarItems } from "../../lib/sales/queue/sidebar.ts";

const cloudflare522 = `<!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<title>supabase.co | 522: Connection timed out</title>
Cloudflare Ray ID: a31593ebbbf3e3c4`;

assert.equal(
  publicErrorMessage(new Error(cloudflare522), "Failed to load queue"),
  "The database is temporarily unreachable. Wait a minute and retry."
);
assert.equal(
  publicErrorMessage("fetch failed", "x"),
  "The database is temporarily unreachable. Wait a minute and retry."
);
assert.equal(publicErrorMessage("Contact needs a name and verified-format email", "x"), "Contact needs a name and verified-format email");
assert.equal(apiErrorFromBody({ error: cloudflare522 }, "Failed to load queue"), "The database is temporarily unreachable. Wait a minute and retry.");
assert.equal(publicErrorMessage("", "fallback"), "fallback");

const sorted = sortQueueSidebarItems([
  {
    queueItem: { id: "low", kind: "initial" },
    organizationName: "Low",
    totalScore: 10,
    draftConfidence: null,
  },
  {
    queueItem: { id: "high", kind: "initial" },
    organizationName: "High",
    totalScore: 90,
    draftConfidence: null,
  },
  {
    queueItem: { id: "nudge", kind: "nudge" },
    organizationName: "Nudge",
    totalScore: null,
    draftConfidence: 0.8,
  },
]);
assert.equal(sorted[0].queueItem.id, "high");
assert.equal(sorted[1].queueItem.id, "nudge");
assert.equal(sorted[2].queueItem.id, "low");
assert.equal(queueSidebarSortScore({ totalScore: null, draftConfidence: 0.5 }), 50);
assert.equal(queueSidebarSortScore({ totalScore: null, draftConfidence: null }), -1);

console.log("queue sidebar + error sanitizer ok");
