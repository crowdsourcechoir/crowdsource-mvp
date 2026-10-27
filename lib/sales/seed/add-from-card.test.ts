import assert from "node:assert/strict";
import { normalizeCardExtract } from "@/lib/sales/card-scan/extract";
import { EMPTY_CARD_EXTRACT } from "@/lib/sales/card-scan/schema";

/** Lightweight contract checks for card → Interest save inputs (no DB). */
function main() {
  const extract = normalizeCardExtract({
    ...EMPTY_CARD_EXTRACT,
    fullName: "Jordan Lee",
    organizationName: "NAIS",
    email: "jordan@nais.org",
    phone: "+1 202 555 0100",
    websiteUrl: "nais.org",
    confidence: 0.9,
  });
  assert.equal(extract.organizationName, "NAIS");
  assert.equal(extract.websiteUrl, "https://nais.org");
  assert.ok(extract.email);

  const noIdentity = normalizeCardExtract({ ...EMPTY_CARD_EXTRACT, notes: "booth 12" });
  assert.equal(noIdentity.fullName, null);
  assert.equal(noIdentity.organizationName, null);
  assert.equal(noIdentity.email, null);
  assert.equal(noIdentity.phone, null);

  console.log("add-from-card.test.ts: ok");
}

main();
