import assert from "node:assert/strict";
import {
  EMAIL_SIGNATURE,
  WEBSITE_HREF,
  ensureEmailSignature,
  ensureEmailSignatureHtml,
  hasEmailSignature,
  stripEmailSignature,
} from "./signature";
import {
  normalizeCrowdsourceWebsiteLinks,
  replaceAttachmentWithBookLink,
} from "./bookUrl";

const letter = "Hi Ada,\n\nI've included a bit more about the experience here:\nhttps://www.crowdsourcechoir.com/book\n\nBest,\nJoel";
const rewritten = normalizeCrowdsourceWebsiteLinks(letter);
assert.doesNotMatch(rewritten, /\/book/);
assert.match(rewritten, /www\.crowdsourcechoir\.com/);

const htmlWithBook = `<p>See <a href="https://www.crowdsourcechoir.com/book">https://www.crowdsourcechoir.com/book</a></p>`;
const htmlRewritten = normalizeCrowdsourceWebsiteLinks(htmlWithBook);
assert.equal(htmlRewritten, `<p>See <a href="https://www.crowdsourcechoir.com">www.crowdsourcechoir.com</a></p>`);

const attachRewritten = replaceAttachmentWithBookLink("Hi Ada,\n\nI've attached a one-page overview for you.\n\nBest,\nJoel");
assert.doesNotMatch(attachRewritten, /attached a one-page/);
assert.doesNotMatch(attachRewritten, /\/book/);
assert.match(attachRewritten, /www\.crowdsourcechoir\.com/);

const signed = ensureEmailSignature(rewritten);
assert.equal(hasEmailSignature(signed), true);
assert.ok(signed.endsWith(EMAIL_SIGNATURE));
assert.equal(ensureEmailSignature(signed), signed);
assert.equal(ensureEmailSignature(signed).split(EMAIL_SIGNATURE).length - 1, 1);
assert.equal(stripEmailSignature(signed), rewritten);

const html = ensureEmailSignatureHtml("<html><body><p>Hi</p></body></html>");
assert.match(html, /Joel DeJong/);
assert.match(html, /American Songwriter/);
assert.ok(html.includes(`<a href="${WEBSITE_HREF}"`));
assert.match(html, />Crowdsource Choir<\/a>/);
assert.ok(html.includes("</body>"));
assert.equal(ensureEmailSignatureHtml(html), html);

console.log("signature and website link tests passed");
