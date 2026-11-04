import assert from "node:assert/strict";
import { ENTERTAINMENT_BOOKING_AGENCIES_SEEDS } from "./entertainment-booking-agencies";

function main() {
  const neste = ENTERTAINMENT_BOOKING_AGENCIES_SEEDS.find((s) => s.name === "Neste Live!");
  assert.ok(neste, "Neste Live! seed present");
  assert.equal(neste!.contacts.length, 3);
  const emails = neste!.contacts.map((c) => c.email.toLowerCase());
  assert.equal(new Set(emails).size, 3, "unique emails");
  assert.ok(emails.every((e) => e.endsWith("@livenation.com")), "Live Nation domain only");
  assert.ok(emails.includes("jillkopecky@livenation.com"));
  assert.ok(emails.includes("nesteinfo@livenation.com"));
  assert.ok(!emails.some((e) => e.endsWith("@nestelive.com")), "no fake nestelive.com inboxes");
  console.log("fix-neste-live-contacts tests passed");
}

main();
