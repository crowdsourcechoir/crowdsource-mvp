import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression: pending queue list must page through PostgREST's 1000-row cap.
 * Without range(), "To send" / Last 7 days silently dropped newest Elevate/Amplify rows.
 */
function main() {
  const src = readFileSync(join(import.meta.dirname, "queue.ts"), "utf8");
  const fnStart = src.indexOf("export async function listQueueItems");
  assert.ok(fnStart >= 0, "listQueueItems should exist");
  const nextExport = src.indexOf("\nexport async function", fnStart + 1);
  const body = nextExport >= 0 ? src.slice(fnStart, nextExport) : src.slice(fnStart);
  assert.match(body, /\.range\(/, "listQueueItems must paginate with .range()");
  assert.match(body, /pageSize\s*=\s*1000/, "listQueueItems should page in 1000-row chunks");
  // Pending path must not be a single unpaged select (historical bug).
  assert.doesNotMatch(
    body,
    /status !== "all"[\s\S]*const \{ data, error \} = await query;\s*\n\s*if \(error\)/,
    "pending listQueueItems must not use a single unpaged query"
  );
  console.log("queue-list-pagination tests passed");
}

main();
