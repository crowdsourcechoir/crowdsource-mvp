import assert from "node:assert/strict";
import { verifyWithHunter } from "./hunter-verifier";

async function main() {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.HUNTER_API_KEY;
  process.env.HUNTER_API_KEY = "test-key";

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        data: {
          status: "invalid",
          score: 0,
          smtp_check: false,
          accept_all: false,
          disposable: false,
          gibberish: false,
          mx_records: true,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )) as typeof fetch;

  const result = await verifyWithHunter("nobody@example.org");
  assert.equal(result.ok, true);
  assert.equal(result.status, "invalid");
  assert.equal(result.smtpCheck, false);

  process.env.HUNTER_API_KEY = originalKey;
  globalThis.fetch = originalFetch;
  console.log("hunter-verifier tests passed");
}

void main();
