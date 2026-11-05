import assert from "node:assert/strict";
import { isPlausibleEmail, normalizeEmail } from "./dedupe";

function main() {
  assert.equal(normalizeEmail("carid@thefair.com."), "carid@thefair.com");
  assert.equal(normalizeEmail("  CariD@TheFair.com, "), "carid@thefair.com");
  assert.equal(normalizeEmail("events@org.org;"), "events@org.org");
  assert.equal(normalizeEmail("null"), null);
  assert.equal(isPlausibleEmail("carid@thefair.com."), true, "trailing period is stripped then accepted");
  assert.equal(isPlausibleEmail("not-an-email"), false);
  assert.equal(isPlausibleEmail("foo@"), false);
  console.log("dedupe normalize-email tests passed");
}

main();
