import assert from "node:assert/strict";
import { classifyInbound, replyKindFromActivity } from "./inbound-kind";

async function main() {
  assert.equal(
    classifyInbound({
      snippet: "Your message wasn't delivered to tanner@ats.edu because the address couldn't be found.",
    }),
    "bounce"
  );
  assert.equal(
    classifyInbound({
      snippet: "Delivery has failed to these recipients or groups.",
    }),
    "bounce"
  );
  assert.equal(
    classifyInbound({
      from: "Former staff <person@example.org>",
      subject: "Re: Crowdsource Choir",
      snippet: "He's no longer checking this email address.",
    }),
    "auto"
  );
  assert.equal(
    classifyInbound({
      snippet: "I no longer work at the CCCU. Please contact the office.",
    }),
    "auto"
  );
  assert.equal(
    classifyInbound({
      snippet: "I have retired from my position as of June.",
    }),
    "auto"
  );
  assert.equal(
    classifyInbound({
      snippet: "Dear colleague, I retired from the American Association of Community Colleges (AACC) on June 30.",
    }),
    "auto"
  );
  assert.equal(
    classifyInbound({
      snippet: "I'm out on the road visiting schools and taking some vacation time. Thanks for your patience.",
    }),
    "auto"
  );
  assert.equal(
    classifyInbound({
      from: "Kyle Hoob <hoob@gonzaga.edu>",
      subject: "Re: Crowdsource Choir for Gonzaga",
      snippet: "Hi Joel, thanks for following up — let's set a time.",
    }),
    "live"
  );

  assert.equal(
    replyKindFromActivity({
      metadata: { snippet: "Address not found. Your message wasn't delivered." },
    }),
    "bounce"
  );
  assert.equal(
    replyKindFromActivity({
      metadata: { kind: "live", snippet: "I have retired from my position." },
    }),
    "auto"
  );

  console.log("inbound kind tests passed");
}

void main();
