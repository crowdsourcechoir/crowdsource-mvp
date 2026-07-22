// Dev-mode batch utility: processes the next N unprocessed organizations through the pipeline
// against the local dev server (`npm run dev` must already be running), with retry on transient
// network/404 errors — the local Next.js dev compiler occasionally drops an in-flight request or
// serves a stale/mid-recompile 404 under back-to-back requests; this doesn't happen against a
// deployed instance. Usage: `node scripts/sales/_batch-fill-funnel.mjs [count=25]`. For best
// results, restart the dev server fresh right before a large batch.
const BASE_URL = "http://localhost:3000";
const BATCH_SIZE = Number(process.argv[2] || 25);
const RETRY_DELAYS_MS = [3000, 8000, 15000];

async function fetchJson(url, options) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    try {
      return { ok: res.ok, status: res.status, json: JSON.parse(text) };
    } catch {
      return { ok: false, status: res.status, json: null, rawSnippet: text.slice(0, 120) };
    }
  } catch (err) {
    // Network-level failure (e.g. dev server mid hot-reload closed the socket) — treat as
    // retryable rather than crashing the whole batch, same as a non-JSON HTTP response.
    return { ok: false, status: 0, json: null, rawSnippet: err instanceof Error ? err.message : String(err) };
  }
}

async function runOne(orgId, orgName) {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const result = await fetchJson(`${BASE_URL}/api/sales/pipeline/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: orgId }),
    });
    if (result.ok && result.json) return result.json.summary ?? result.json;
    if (attempt < RETRY_DELAYS_MS.length) {
      console.log(`  [retry ${attempt + 1}] ${orgName} — ${result.status} non-JSON, waiting ${RETRY_DELAYS_MS[attempt]}ms`);
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    } else {
      return { status: "failed_after_retries", error: `HTTP ${result.status}` };
    }
  }
}

const listRes = await fetchJson(`${BASE_URL}/api/sales/organizations/unprocessed?limit=${BATCH_SIZE}`);
if (!listRes.ok) {
  console.error("Failed to list unprocessed organizations:", listRes.status);
  process.exit(1);
}
const orgs = listRes.json.organizations;
console.log(`Processing ${orgs.length} organizations...\n`);

const tally = { succeeded: 0, failed: 0, queuedOpportunities: 0, skippedExistingClient: 0 };
for (const [i, org] of orgs.entries()) {
  process.stdout.write(`[${i + 1}/${orgs.length}] ${org.name} ... `);
  const summary = await runOne(org.id, org.name);
  if (summary?.status === "succeeded") {
    tally.succeeded += 1;
    tally.queuedOpportunities += summary.opportunityIds?.length ?? 0;
    console.log(`ok (${summary.opportunityIds?.length ?? 0} opportunity ids)`);
  } else if (summary?.status === "skipped_existing_client") {
    tally.skippedExistingClient += 1;
    console.log("skipped (existing client)");
  } else {
    tally.failed += 1;
    console.log(`FAILED: ${JSON.stringify(summary)}`);
  }
}

console.log("\n=== SUMMARY ===");
console.log(tally);
