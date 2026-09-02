/**
 * Queue email list formatting.
 * Run: npx tsx scripts/sales/test-email-body-format.mjs
 */
import assert from "node:assert/strict";
import {
  clipboardHtmlToMarkdown,
  draftToEmailHtml,
  draftToPlainText,
  editorHtmlToMarkdown,
  markdownToEditorHtml,
  markdownToEmailHtml,
  normalizeListPlainText,
  pasteToMarkdown,
  sanitizeEmailHtml,
} from "../../lib/sales/outreach/email-body-format.ts";
import { buildGmailMime } from "../../lib/sales/gmail/mime.ts";

const draft = `Hi Carmen,

I hope you're doing well!

Here are a few options:

- a Song Garden that can live in the space
- an original anthem the whole room performs
- a season-long pipeline of shared singing

There's a little more here:
https://www.crowdsourcechoir.com/book

Best,
Joel`;

const html = markdownToEditorHtml(draft);
assert.match(html, /<ul>/);
assert.match(html, /<li>a Song Garden/);
assert.match(html, /<p>Best,<br>Joel<\/p>/);

const roundTrip = editorHtmlToMarkdown(html);
assert.match(roundTrip, /- a Song Garden that can live in the space/);
assert.match(roundTrip, /- an original anthem the whole room performs/);
assert.match(roundTrip, /Best,\nJoel/);
assert.equal(editorHtmlToMarkdown(markdownToEditorHtml(roundTrip)).replace(/\n+/g, "\n"), roundTrip.replace(/\n+/g, "\n"));

const numbered = `Options:\n\n1. Opening\n2. Mid-program\n3. Close`;
assert.match(markdownToEditorHtml(numbered), /<ol>/);
assert.match(editorHtmlToMarkdown(markdownToEditorHtml(numbered)), /1\. Opening/);
assert.match(editorHtmlToMarkdown(markdownToEditorHtml(numbered)), /3\. Close/);

const googleDocs = `<meta charset="utf-8"><b style="font-weight:normal;"><ul><li>Apples</li><li>Oranges</li></ul><ol><li>First</li><li>Second</li></ol></b>`;
const fromDocs = clipboardHtmlToMarkdown(googleDocs);
assert.match(fromDocs, /- Apples/);
assert.match(fromDocs, /- Oranges/);
assert.match(fromDocs, /1\. First/);
assert.match(fromDocs, /2\. Second/);

const googleDocsNestedP = `<ul><li dir="ltr"><p dir="ltr">Keep the garden</p></li><li dir="ltr"><p dir="ltr">Share the anthem</p></li></ul>`;
assert.equal(
  clipboardHtmlToMarkdown(googleDocsNestedP),
  "- Keep the garden\n- Share the anthem"
);

const wordHtml = `<p class=MsoListParagraphCxSpFirst style='mso-list:l0 level1 lfo1'><!--[if !supportLists]--><span>·</span><!--[endif]-->Hello world</p><p class=MsoListParagraphCxSpLast style='mso-list:l0 level1 lfo1'>• Next item</p>`;
const fromWord = clipboardHtmlToMarkdown(wordHtml);
assert.match(fromWord, /- Hello world/);
assert.match(fromWord, /- Next item/);

assert.equal(normalizeListPlainText("• Alpha\n• Bravo"), "- Alpha\n- Bravo");
assert.equal(normalizeListPlainText("1) One\n2) Two"), "1. One\n2. Two");

const pasteLostHtml = pasteToMarkdown("<p>Alpha</p><p>Bravo</p>", "• Alpha\n• Bravo");
assert.equal(pasteLostHtml, "- Alpha\n- Bravo");

const pasteHtmlWins = pasteToMarkdown("<ul><li>From HTML</li></ul>", "From plain");
assert.match(pasteHtmlWins, /- From HTML/);

const emailHtml = markdownToEmailHtml(draft);
assert.match(emailHtml, /list-style-type:disc/);
assert.match(emailHtml, /<ul /);
assert.match(emailHtml, /<li /);
assert.match(emailHtml, /href="https:\/\/www\.crowdsourcechoir\.com\/book"/);
assert.doesNotMatch(emailHtml, /<script/i);

const unchanged = `Hi First,\n\nI hope you're doing well!\n\nBest,\nJoel`;
assert.doesNotMatch(markdownToEditorHtml(unchanged), /<ul>|<ol>/);
assert.match(editorHtmlToMarkdown(markdownToEditorHtml(unchanged)), /I hope you're doing well!/);

const mime = buildGmailMime({
  from: "sing@crowdsourcechoir.com",
  to: "carmen@laautoshow.com",
  subject: "Crowdsource Choir + LA Auto Show",
  body: draft,
  boundary: "testboundary",
});
assert.match(mime, /Content-Type: multipart\/alternative; boundary="testboundary"/);
assert.match(mime, /Content-Type: text\/plain; charset="UTF-8"/);
assert.match(mime, /Content-Type: text\/html; charset="UTF-8"/);
assert.match(mime, /- a Song Garden that can live in the space/);
assert.match(mime, /<ul /);
assert.match(mime, /<li /);

const namedMd = `See [the book](https://www.crowdsourcechoir.com/book) for more.`;
assert.match(markdownToEmailHtml(namedMd), /href="https:\/\/www\.crowdsourcechoir\.com\/book"/);
assert.match(markdownToEmailHtml(namedMd), />the book</);
assert.match(markdownToEditorHtml(namedMd), /<a href="https:\/\/www\.crowdsourcechoir\.com\/book"/);

const htmlDraft = `<p>See <a href="https://www.crowdsourcechoir.com/book">the book</a> page.</p><ul><li>a Song Garden with a <a href="https://www.crowdsourcechoir.com/book">book link</a></li></ul>`;
const htmlEmail = draftToEmailHtml(htmlDraft);
assert.match(htmlEmail, /href="https:\/\/www\.crowdsourcechoir\.com\/book"/);
assert.match(htmlEmail, />the book</);
assert.match(htmlEmail, /list-style-type:disc/);
assert.match(draftToPlainText(htmlDraft), /\[the book\]\(https:\/\/www\.crowdsourcechoir\.com\/book\)/);
assert.match(draftToPlainText(htmlDraft), /\[book link\]\(https:\/\/www\.crowdsourcechoir\.com\/book\)/);
assert.match(draftToPlainText(htmlDraft), /- a Song Garden with a \[book link\]/);

const dirty = `<p><a href="javascript:alert(1)">x</a><img src="x" onerror="alert(1)"><a href="https://ok.example">safe</a></p>`;
const cleaned = sanitizeEmailHtml(dirty);
assert.doesNotMatch(cleaned, /javascript:/i);
assert.doesNotMatch(cleaned, /onerror/i);
assert.doesNotMatch(cleaned, /<img/i);
assert.match(cleaned, /href="https:\/\/ok\.example"/);

const mimeHtml = buildGmailMime({
  from: "sing@crowdsourcechoir.com",
  to: "carmen@laautoshow.com",
  subject: "Crowdsource Choir + LA Auto Show",
  body: htmlDraft,
  boundary: "htmlboundary",
});
assert.match(mimeHtml, /Content-Type: multipart\/alternative; boundary="htmlboundary"/);
assert.match(mimeHtml, /href="https:\/\/www\.crowdsourcechoir\.com\/book"/);
const plainPart = mimeHtml.split("text/plain")[1].split("text/html")[0];
assert.doesNotMatch(plainPart, /<p>/);
assert.match(plainPart, /\[the book\]\(https:\/\/www\.crowdsourcechoir\.com\/book\)/);

console.log("email body list formatting ok");
