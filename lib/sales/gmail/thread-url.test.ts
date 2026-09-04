import assert from "node:assert/strict";
import { gmailThreadUrl } from "./constants";

async function main() {
  assert.equal(gmailThreadUrl("abc123"), "https://mail.google.com/mail/#all/abc123");
  assert.equal(
    gmailThreadUrl("abc123", "sing@crowdsourcechoir.com"),
    "https://mail.google.com/mail/?authuser=sing%40crowdsourcechoir.com#all/abc123"
  );
  assert.ok(!gmailThreadUrl("abc123", "sing@crowdsourcechoir.com").includes("/u/0/"));
  assert.ok(!gmailThreadUrl("abc123", "sing@crowdsourcechoir.com").includes("rfc822msgid"));
  console.log("gmail thread url tests passed");
}

void main();
