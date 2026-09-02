import assert from "node:assert/strict";
import { insertMarkdownLink, prepareOutboundEmail, renderEmailBodyHtml, sanitizeHttpUrl } from "./email-html";
import { EMAIL_SIGNATURE_PLAIN, EMAIL_SIGNATURE_QUOTE, ensureEmailSignature, stripEmailSignature } from "./signature";

const sample = `Hi Alex,\n\nThere's a little more here: www.crowdsourcechoir.com/book\n\nBest,\nJoel`;

const signedOnce = ensureEmailSignature(sample);
assert.ok(signedOnce.includes(EMAIL_SIGNATURE_PLAIN));
assert.equal(ensureEmailSignature(signedOnce), signedOnce, "ensureEmailSignature is idempotent");

const oldQuoted = `${sample}\n\n--\nJoel DeJong\nCreator, Crowdsource Choir\n'${EMAIL_SIGNATURE_QUOTE}'\n—American Songwriter`;
assert.equal(stripEmailSignature(oldQuoted), sample);

const htmlSigned = `${sample}\n\n--\nJoel DeJong\nCreator, Crowdsource Choir\n<i style="font-style:italic">"${EMAIL_SIGNATURE_QUOTE}"</i>\n—American Songwriter`;
assert.equal(stripEmailSignature(htmlSigned), sample);

const outbound = prepareOutboundEmail(sample);
assert.ok(outbound.plain.endsWith(EMAIL_SIGNATURE_PLAIN));
assert.ok(outbound.html.includes(`<i style="font-style:italic">"${EMAIL_SIGNATURE_QUOTE}"</i>`));
assert.ok(outbound.html.includes("Joel DeJong"));
assert.ok(outbound.html.includes('href="https://www.crowdsourcechoir.com/book"'));
assert.ok(!outbound.html.includes("<script"));

const withMarkdown = renderEmailBodyHtml("See [the book](https://www.crowdsourcechoir.com/book) today.");
assert.match(withMarkdown, /<a href="https:\/\/www\.crowdsourcechoir\.com\/book"[^>]*>the book<\/a>/);
assert.ok(!withMarkdown.includes("[the book]"));

assert.equal(sanitizeHttpUrl("javascript:alert(1)"), null);
assert.equal(sanitizeHttpUrl("https://www.crowdsourcechoir.com/book"), "https://www.crowdsourcechoir.com/book");
assert.equal(sanitizeHttpUrl("www.example.com/path"), "https://www.example.com/path");

const inserted = insertMarkdownLink("Hello world", 6, 11, "https://example.com", "world");
assert.ok(!("error" in inserted));
assert.equal(inserted.body, "Hello [world](https://example.com/)");

const rejected = insertMarkdownLink("Hello", 0, 5, "javascript:alert(1)");
assert.ok("error" in rejected);

const escaped = renderEmailBodyHtml('Hi <script>alert(1)</script>');
assert.ok(escaped.includes("&lt;script&gt;"));
assert.ok(!escaped.includes("<script>"));

console.log("email-html tests passed");
