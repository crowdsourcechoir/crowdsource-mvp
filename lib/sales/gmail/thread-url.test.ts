import assert from "node:assert/strict";
import { gmailDraftUrl, gmailThreadUrl, hasGmailComposeScope } from "./constants";

async function main() {
  assert.equal(gmailThreadUrl("abc123"), "https://mail.google.com/mail/#all/abc123");
  assert.equal(
    gmailThreadUrl("abc123", "sing@crowdsourcechoir.com"),
    "https://mail.google.com/mail/?authuser=sing%40crowdsourcechoir.com#all/abc123"
  );
  assert.ok(!gmailThreadUrl("abc123", "sing@crowdsourcechoir.com").includes("/u/0/"));
  assert.ok(!gmailThreadUrl("abc123", "sing@crowdsourcechoir.com").includes("rfc822msgid"));

  assert.equal(gmailDraftUrl("18c3f9"), "https://mail.google.com/mail/#drafts/18c3f9");
  assert.equal(
    gmailDraftUrl("18c3f9", "sing@crowdsourcechoir.com"),
    "https://mail.google.com/mail/?authuser=sing%40crowdsourcechoir.com#drafts/18c3f9"
  );
  assert.ok(!gmailDraftUrl("18c3f9", "sing@crowdsourcechoir.com").includes("/u/0/"));

  assert.equal(hasGmailComposeScope(["https://www.googleapis.com/auth/gmail.send"]), false);
  assert.equal(
    hasGmailComposeScope([
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.compose",
    ]),
    true
  );
  assert.equal(hasGmailComposeScope(["https://www.googleapis.com/auth/gmail.modify"]), true);
  assert.equal(hasGmailComposeScope(null), false);

  console.log("gmail thread and draft url tests passed");
}

void main();
