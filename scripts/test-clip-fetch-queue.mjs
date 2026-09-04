/**
 * Smoke: clip fetch queue concurrency.
 * Run: npx tsx scripts/test-clip-fetch-queue.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const { enqueueClipFetch } = await load("lib/songgarden/clip-fetch-queue.ts");

  let concurrent = 0;
  let peak = 0;
  const tasks = Array.from({ length: 20 }, (_, i) =>
    enqueueClipFetch(async () => {
      concurrent += 1;
      peak = Math.max(peak, concurrent);
      await new Promise((r) => setTimeout(r, 20));
      concurrent -= 1;
      return i;
    })
  );

  const results = await Promise.all(tasks);
  assert.equal(results.length, 20);
  assert.ok(peak <= 4, `expected peak concurrency <= 4, got ${peak}`);
  assert.ok(peak >= 2, `expected some concurrency, got ${peak}`);

  console.log("ok — clip fetch queue (peak", peak + ")");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
