import assert from "node:assert/strict";
import { chooseDigestTransport, fromAddressEmail, isResendSandboxSender } from "./transport";

async function main() {
  assert.equal(fromAddressEmail("Crowdsource Sales <onboarding@resend.dev>"), "onboarding@resend.dev");
  assert.equal(fromAddressEmail("digest@crowdsourcechoir.com"), "digest@crowdsourcechoir.com");
  assert.equal(fromAddressEmail(null), null);

  assert.equal(isResendSandboxSender("Crowdsource Sales <onboarding@resend.dev>"), true);
  assert.equal(isResendSandboxSender("digest@crowdsourcechoir.com"), false);
  assert.equal(isResendSandboxSender(null), true);

  // The failing production setup: sandbox sender, recipient is the connected Gmail account.
  const sandbox = chooseDigestTransport({
    resendApiKey: "re_live_key",
    resendFrom: "Crowdsource Sales <onboarding@resend.dev>",
    configuredTo: "sing@crowdsourcechoir.com",
    gmailConnected: true,
    gmailEmail: "sing@crowdsourcechoir.com",
  });
  assert.equal(sandbox.transport, "gmail");
  assert.equal(sandbox.to, "sing@crowdsourcechoir.com");

  const verified = chooseDigestTransport({
    resendApiKey: "re_live_key",
    resendFrom: "Crowdsource Sales <digest@crowdsourcechoir.com>",
    configuredTo: "sing@crowdsourcechoir.com",
    gmailConnected: true,
    gmailEmail: "sing@crowdsourcechoir.com",
  });
  assert.equal(verified.transport, "resend");

  // No recipient configured falls back to the connected mailbox.
  const defaulted = chooseDigestTransport({
    resendApiKey: null,
    resendFrom: null,
    configuredTo: null,
    gmailConnected: true,
    gmailEmail: "sing@crowdsourcechoir.com",
  });
  assert.equal(defaulted.transport, "gmail");
  assert.equal(defaulted.to, "sing@crowdsourcechoir.com");

  // Gmail must never carry mail to a third party — that is prospect outreach, not a self-digest.
  const thirdParty = chooseDigestTransport({
    resendApiKey: "re_live_key",
    resendFrom: "onboarding@resend.dev",
    configuredTo: "someone-else@example.org",
    gmailConnected: true,
    gmailEmail: "sing@crowdsourcechoir.com",
  });
  assert.equal(thirdParty.transport, "none");
  assert.match(thirdParty.reason ?? "", /sandbox sender/);

  const nothing = chooseDigestTransport({
    resendApiKey: null,
    resendFrom: null,
    configuredTo: null,
    gmailConnected: false,
    gmailEmail: null,
  });
  assert.equal(nothing.transport, "none");
  assert.equal(nothing.to, null);

  console.log("digest transport tests passed");
}

void main();
