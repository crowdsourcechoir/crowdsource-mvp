import assert from "node:assert/strict";
import { assertCardImageDataUrl, normalizeCardExtract } from "./extract";
import { EMPTY_CARD_EXTRACT } from "./schema";

function main() {
  assert.throws(() => assertCardImageDataUrl("http://example.com/card.jpg"), /JPEG, PNG, or WebP/);
  const ok = assertCardImageDataUrl("data:image/jpeg;base64,/9j/4AAQ");
  assert.ok(ok.startsWith("data:image/jpeg"));

  const normalized = normalizeCardExtract({
    ...EMPTY_CARD_EXTRACT,
    fullName: "  Ada  Lovelace ",
    email: "Ada@Example.COM",
    websiteUrl: "example.com",
    linkedinUrl: "linkedin.com/in/ada",
    phone: " 555-0100 ",
    confidence: 1.4,
  });
  assert.equal(normalized.fullName, "Ada Lovelace");
  assert.equal(normalized.email, "ada@example.com");
  assert.equal(normalized.websiteUrl, "https://example.com");
  assert.equal(normalized.linkedinUrl, "https://linkedin.com/in/ada");
  assert.equal(normalized.phone, "555-0100");
  assert.equal(normalized.confidence, 1);

  console.log("extract.test.ts: ok");
}

main();
