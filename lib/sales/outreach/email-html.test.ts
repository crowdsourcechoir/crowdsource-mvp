import assert from "node:assert/strict";
import { insertMarkdownLink, prepareOutboundEmail, renderEmailBodyHtml, sanitizeHttpUrl } from "./email-html";
import { EMAIL_SIGNATURE_PLAIN, EMAIL_SIGNATURE_QUOTE, ensureEmailSignature, stripEmailSignature } from "./signature";

const sample = `Hi Alex,\n\nThere's a little more here: www.crowdsourcechoir.com/book\n\nBest,\nJoel`;

const signedOnce = ensureEmailSignature(sample);
assert.ok(signedOnce.includes(EMAIL_SIGNATURE_PLAIN));
assert.equal(ensureEmailSignature(signedOnce), signedOnce, "ensureEmailSignature is idempotent");

const oldQuoted = `${sample}\n\n--\nJoel DeJong\nCreator, Crowdsource Choir\n'${EMAIL_SIGNATURE_QUOTE}'\n—American Songwriter`;
assert.equal(stripEmailSignature(oldQuoted), sample);

const htmlSigned = `${sample}\n\n--\nJoel DeJong\nCreator, Crowdsource Choir\n<span style="font-style:italic">"${EMAIL_SIGNATURE_QUOTE}"</span>\n—American Songwriter`;
assert.equal(stripEmailSignature(htmlSigned), sample);

const outbound = prepareOutboundEmail(sample);
assert.ok(outbound.plain.endsWith(EMAIL_SIGNATURE_PLAIN));
assert.ok(outbound.html.includes(`font-style:italic`));
assert.ok(outbound.html.includes(EMAIL_SIGNATURE_QUOTE));
assert.ok(outbound.html.includes("Joel DeJong"));
assert.ok(outbound.html.includes('href="https://www.crowdsourcechoir.com/book"'));
assert.ok(!outbound.html.includes("<script"));

const withMd = prepareOutboundEmail("See [the book](https://www.crowdsourcechoir.com/book) today.");
assert.equal(withMd.plain.includes("[the book]"), false);
assert.ok(withMd.plain.includes("the book (https://www.crowdsourcechoir.com/book)"));
assert.match(withMd.html, /<a href="https:\/\/www\.crowdsourcechoir\.com\/book"[^>]*>the book<\/a>/);

assert.equal(sanitizeHttpUrl("javascript:alert(1)"), null);
assert.equal(sanitizeHttpUrl("https://www.crowdsourcechoir.com/book"), "https://www.crowdsourcechoir.com/book");
assert.equal(sanitizeHttpUrl("www.example.com/path"), "https://www.example.com/path");

const inserted = insertMarkdownLink("Hello world", 6, 11, "https://example.com", "world");
assert.ok(!("error" in inserted));
assert.equal(inserted.body, "Hello [world](https://example.com/)");

const padded = insertMarkdownLink("Best,\nJoel", 10, 10, "https://www.crowdsourcechoir.com/book", "book");
assert.ok(!("error" in padded));
assert.match(padded.body, /Joel \[book\]\(https:\/\/www\.crowdsourcechoir\.com\/book\)/);

const rejected = insertMarkdownLink("Hello", 0, 5, "javascript:alert(1)");
assert.ok("error" in rejected);

const escaped = renderEmailBodyHtml('Hi <script>alert(1)</script>');
assert.ok(escaped.includes("&lt;script&gt;"));
assert.ok(!escaped.includes("<script>"));

console.log("email-html tests passed");
