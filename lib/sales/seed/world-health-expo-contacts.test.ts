import assert from "node:assert/strict";
import { isGenericMailboxEmail, isPlausibleEmail, looksLikePersonName } from "../dedupe";
import {
  WORLD_HEALTH_EXPO_CONTACTS,
  WORLD_HEALTH_EXPO_NAME,
  WORLD_HEALTH_EXPO_WEBSITE,
} from "./world-health-expo-contacts";

function main() {
  assert.equal(WORLD_HEALTH_EXPO_CONTACTS.length, 5);
  assert.equal(WORLD_HEALTH_EXPO_NAME, "World Health Expo");
  assert.equal(WORLD_HEALTH_EXPO_WEBSITE, "https://www.worldhealthexpo.com/");

  const enjy = WORLD_HEALTH_EXPO_CONTACTS.find((c) => c.fullName === "Enjy El Mokadem");
  assert.ok(enjy);
  assert.equal(enjy!.email, null, "do not invent a direct email");
  assert.match(enjy!.roleDescription, /congress\.whx@informa\.com/);
  assert.equal(looksLikePersonName(enjy!.fullName), true);

  const emails = WORLD_HEALTH_EXPO_CONTACTS.map((c) => c.email).filter((e): e is string => Boolean(e));
  assert.deepEqual(emails, [
    "congress.whx@informa.com",
    "sales.whxdubai@informa.com",
    "rubina.dsouza@informa.com",
    "tom.coleman@informa.com",
  ]);
  assert.equal(new Set(emails).size, emails.length);
  assert.ok(emails.every((e) => isPlausibleEmail(e) && e.endsWith("@informa.com")));
  assert.equal(isGenericMailboxEmail("congress.whx@informa.com"), true);
  assert.equal(isGenericMailboxEmail("sales.whxdubai@informa.com"), false);

  for (const contact of WORLD_HEALTH_EXPO_CONTACTS) {
    assert.ok(contact.roleTitle.trim(), contact.fullName);
    assert.ok(contact.roleDescription.trim(), contact.fullName);
    if (contact.email) assert.equal(contact.roleDescription.includes(contact.email), true);
  }

  console.log("world-health-expo-contacts tests passed");
}

main();
