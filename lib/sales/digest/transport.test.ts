import assert from "node:assert/strict";
import { chooseDigestTransport } from "./transport";

async function main() {
  const self = chooseDigestTransport({
    configuredTo: "sing@crowdsourcechoir.com",
    gmailConnected: true,
    gmailEmail: "sing@crowdsourcechoir.com",
  });
  assert.equal(self.transport, "gmail");
  assert.equal(self.to, "sing@crowdsourcechoir.com");

  // No recipient configured falls back to the connected mailbox.
  const defaulted = chooseDigestTransport({
    configuredTo: null,
    gmailConnected: true,
    gmailEmail: "sing@crowdsourcechoir.com",
  });
  assert.equal(defaulted.transport, "gmail");
  assert.equal(defaulted.to, "sing@crowdsourcechoir.com");

  // Gmail must never carry mail to a third party — that is prospect outreach, not a self-digest.
  const thirdParty = chooseDigestTransport({
    configuredTo: "someone-else@example.org",
    gmailConnected: true,
    gmailEmail: "sing@crowdsourcechoir.com",
  });
  assert.equal(thirdParty.transport, "none");
  assert.match(thirdParty.reason ?? "", /must match the connected Gmail/);

  // Resend must not be selected even if a key were present historically — digest is Gmail-only.
  const nothing = chooseDigestTransport({
    configuredTo: null,
    gmailConnected: false,
    gmailEmail: null,
  });
  assert.equal(nothing.transport, "none");
  assert.equal(nothing.to, null);

  const disconnectedWithRecipient = chooseDigestTransport({
    configuredTo: "sing@crowdsourcechoir.com",
    gmailConnected: false,
    gmailEmail: null,
  });
  assert.equal(disconnectedWithRecipient.transport, "none");
  assert.match(disconnectedWithRecipient.reason ?? "", /Connect Gmail/);

  console.log("digest transport tests passed");
}

void main();
