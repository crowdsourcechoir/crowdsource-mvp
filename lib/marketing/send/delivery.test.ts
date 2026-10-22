// node --experimental-strip-types --import ./scripts/marketing/register-strip-types.mjs lib/marketing/send/delivery.test.ts
import assert from "node:assert/strict";
import { personMatchesSegment, sendablePeople, type AudiencePerson } from "./audience";
import { auditSendableHtml, checkListSend, checkTestSend, chooseTestTransport } from "./checks";
import { listHeaders, messageForRecipient, testSubject, testUnsubscribeLink } from "./deliver";
import type { PreparedSend } from "./prepare";
import { liveUnsubscribeToken, testUnsubscribeToken, verifyUnsubscribeToken } from "../unsubscribe";
import { forwardStatus, mapResendWebhook } from "./webhook";

const secret = "test-secret";
const testToken = testUnsubscribeToken("Sing@Example.com", secret);
const testClaim = verifyUnsubscribeToken(testToken, secret);
assert.equal(testClaim?.kind, "test");
assert.equal(testClaim && testClaim.kind === "test" ? testClaim.email : "", "sing@example.com");
assert.equal(verifyUnsubscribeToken(testToken, "other-secret"), null);
assert.equal(testToken.startsWith("test."), true);

const liveToken = liveUnsubscribeToken("person-1", "sub-1", secret);
const liveClaim = verifyUnsubscribeToken(liveToken, secret);
assert.equal(liveClaim?.kind, "live");
assert.equal(liveClaim && liveClaim.kind === "live" ? liveClaim.personId : "", "person-1");
assert.notEqual(testClaim?.kind, "live");

const previousSecret = process.env.MARKETING_UNSUBSCRIBE_SECRET;
const previousKill = process.env.MARKETING_SENDS_ENABLED;
process.env.MARKETING_UNSUBSCRIBE_SECRET = "";
process.env.MARKETING_SENDS_ENABLED = "";
assert.match(testUnsubscribeLink("a@b.co"), /preview=test$/);
process.env.MARKETING_UNSUBSCRIBE_SECRET = secret;
const testLink = testUnsubscribeLink("A@B.co");
assert.match(testLink, /token=/);
assert.doesNotMatch(testLink, /[?&]email=/);
const linked = verifyUnsubscribeToken(decodeURIComponent(new URL(testLink).searchParams.get("token") ?? ""), secret);
assert.equal(linked?.kind, "test");

assert.equal(checkTestSend({ to: "not-an-email", fromEmail: "from@example.com", resendConfigured: true }).ok, false);
assert.equal(
  checkTestSend({ to: "a@b.co", fromEmail: "", resendConfigured: true }).ok,
  false
);
const testOk = checkTestSend({ to: "A@B.co", fromEmail: "from@example.com", resendConfigured: true });
assert.equal(testOk.ok, true);
if (testOk.ok) assert.equal(testOk.to, "a@b.co");
process.env.MARKETING_SENDS_ENABLED = "false";
assert.match(checkTestSend({ to: "a@b.co", fromEmail: "from@example.com", resendConfigured: true }).ok ? "" : "killed", /killed/);
const killedButGmail = chooseTestTransport({
  to: "a@b.co",
  fromEmail: "from@example.com",
  resendConfigured: true,
  gmailSendsEnabled: true,
});
assert.equal(killedButGmail.ok && killedButGmail.transport, "gmail");
const killedNoGmail = chooseTestTransport({
  to: "a@b.co",
  fromEmail: "from@example.com",
  resendConfigured: true,
  gmailSendsEnabled: false,
});
assert.equal(killedNoGmail.ok, false);
process.env.MARKETING_SENDS_ENABLED = "";
const viaGoogle = chooseTestTransport({
  to: "Sing@Example.com",
  fromEmail: "",
  resendConfigured: false,
  gmailSendsEnabled: true,
});
assert.equal(viaGoogle.ok && viaGoogle.transport, "gmail");
if (viaGoogle.ok) assert.equal(viaGoogle.to, "sing@example.com");
const resendFirst = chooseTestTransport({
  to: "a@b.co",
  fromEmail: "from@example.com",
  resendConfigured: true,
  gmailSendsEnabled: true,
});
assert.equal(resendFirst.ok && resendFirst.transport, "resend");

const listInput = {
  confirmPhrase: "SEND",
  sendsEnabled: true,
  fromEmail: "from@example.com",
  physicalAddress: "1 Main",
  companyName: "Crowdsource Choir",
  segmentId: "seg-1",
  resendConfigured: true,
  unsubscribeSecret: secret,
};
assert.equal(checkListSend(listInput).ok, true);
assert.equal(checkListSend({ ...listInput, sendsEnabled: false }).ok, false);
assert.equal(checkListSend({ ...listInput, confirmPhrase: "send" }).ok, true);
assert.equal(checkListSend({ ...listInput, confirmPhrase: "yes" }).ok, false);
assert.equal(checkListSend({ ...listInput, segmentId: null }).ok, false);
assert.equal(checkListSend({ ...listInput, unsubscribeSecret: "" }).ok, false);
assert.equal(checkListSend({ ...listInput, physicalAddress: "  " }).ok, false);

const person = (patch: Partial<AudiencePerson>): AudiencePerson => ({
  personId: "p",
  subscriptionId: "s",
  email: "a@b.co",
  firstName: "Ada",
  displayName: "Ada Lovelace",
  city: "Seattle",
  region: "WA",
  country: "US",
  acquisitionSource: "manual",
  tags: ["vip"],
  subscriptionStatus: "subscribed",
  suppressed: false,
  ...patch,
});
const empty = { schemaVersion: 1 as const, match: "all" as const, conditions: [] };
assert.equal(personMatchesSegment(person({}), empty), false);
assert.equal(sendablePeople([person({})], empty).length, 0);
const seattle = {
  schemaVersion: 1 as const,
  match: "all" as const,
  conditions: [
    { type: "attribute" as const, field: "city" as const, op: "eq" as const, value: "seattle" },
    { type: "subscription" as const, topic: "marketing" as const, status: "subscribed" as const },
  ],
};
assert.equal(personMatchesSegment(person({}), seattle), true);
assert.equal(personMatchesSegment(person({ city: "Portland" }), seattle), false);
assert.equal(sendablePeople([person({ suppressed: true }), person({})], seattle).length, 1);

assert.equal(mapResendWebhook("email.bounced", { bounce: { type: "Permanent" } }).suppress, "hard_bounce");
assert.equal(mapResendWebhook("email.bounced", { bounce: { type: "Transient" } }).nextStatus, "delayed");
assert.equal(mapResendWebhook("email.bounced", { bounce: { type: "Transient" } }).suppress, null);
assert.equal(mapResendWebhook("email.complained", {}).suppress, "complaint");
assert.equal(mapResendWebhook("email.complained", {}).unsubscribe, true);
assert.equal(mapResendWebhook("email.opened", {}).nextStatus, null);
assert.equal(mapResendWebhook("email.delivered", {}).nextStatus, "delivered");

assert.equal(forwardStatus("delivered", "delayed"), null);
assert.equal(forwardStatus("sent", "delayed"), "delayed");
assert.equal(forwardStatus("complained", "bounced"), null);
assert.equal(forwardStatus("bounced", "complained"), "complained");
assert.equal(forwardStatus("delivered", "failed"), null);
assert.equal(forwardStatus("sent", "failed"), "failed");
assert.equal(forwardStatus("failed", "bounced"), "bounced");
assert.equal(forwardStatus("delivered", "delivered"), null);

assert.equal(testSubject("Hello"), "[TEST] Hello");
assert.equal(listHeaders("https://example.com/u")["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
assert.match(auditSendableHtml('<img src="http://example.com/a.png">') ?? "", /https image/);
assert.equal(auditSendableHtml('<img src="https://example.com/a.png">'), null);

const prepared = {
  html: 'Hi {{first_name}} <a href="{{unsubscribe_url}}">Unsubscribe</a>',
  text: "Hi {{first_name}} {{unsubscribe_url}}",
  fromName: 'Choir "Band" <x>',
  fromEmail: "sing@crowdsourcechoir.com",
  replyTo: null,
  document: { personalization: { missingTokenBehavior: "fallback", fallbacks: { first_name: "friend" } } },
} as PreparedSend;
const message = messageForRecipient({
  prepared,
  to: "a@b.co",
  firstName: "Ada",
  unsubscribe: "https://app.crowdsourcechoir.com/api/marketing/unsubscribe?token=live.person.sub.sig",
  subject: testSubject("Night"),
  idempotencyKey: "delivery:1",
});
assert.equal(message.subject, "[TEST] Night");
assert.match(message.html, /Ada/);
assert.doesNotMatch(message.html, /\{\{/);
assert.equal(message.from, "Choir Band x <sing@crowdsourcechoir.com>");
assert.equal(
  message.headers["List-Unsubscribe"],
  "<https://app.crowdsourcechoir.com/api/marketing/unsubscribe?token=live.person.sub.sig>"
);

if (previousSecret === undefined) delete process.env.MARKETING_UNSUBSCRIBE_SECRET;
else process.env.MARKETING_UNSUBSCRIBE_SECRET = previousSecret;
if (previousKill === undefined) delete process.env.MARKETING_SENDS_ENABLED;
else process.env.MARKETING_SENDS_ENABLED = previousKill;

console.log("delivery tests ok");
