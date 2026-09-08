import assert from "node:assert/strict";
import { looksLikeContactPaste, parseContactPaste } from "./parse-contact-paste";

async function main() {
  const blob =
    "Khalilah Elliott: kelliott@carnegiehall.org Sam Meyer: smeyer@carnegiehall.org Maddie Brolly: mbrolly@carnegiehall.org";
  const parsed = parseContactPaste(blob);
  assert.equal(parsed.length, 3);
  assert.deepEqual(parsed[0], { fullName: "Khalilah Elliott", email: "kelliott@carnegiehall.org" });
  assert.deepEqual(parsed[1], { fullName: "Sam Meyer", email: "smeyer@carnegiehall.org" });
  assert.deepEqual(parsed[2], { fullName: "Maddie Brolly", email: "mbrolly@carnegiehall.org" });
  assert.equal(looksLikeContactPaste(blob), true);

  assert.deepEqual(parseContactPaste('"Sam Meyer" <smeyer@carnegiehall.org>'), [
    { fullName: "Sam Meyer", email: "smeyer@carnegiehall.org" },
  ]);

  assert.deepEqual(parseContactPaste("Maddie Brolly mbrolly@carnegiehall.org"), [
    { fullName: "Maddie Brolly", email: "mbrolly@carnegiehall.org" },
  ]);

  assert.deepEqual(parseContactPaste("events team"), []);
  assert.equal(looksLikeContactPaste("director of development"), false);
  assert.deepEqual(parseContactPaste("kelliott@carnegiehall.org"), [], "email alone needs a name");

  console.log("parse-contact-paste tests passed");
}

void main();
