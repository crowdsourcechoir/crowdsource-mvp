import assert from "node:assert/strict";
import {
  EMAIL_SIGNATURE,
  ensureEmailSignature,
  ensureEmailSignatureHtml,
  hasEmailSignature,
  stripEmailSignature,
} from "./signature";

const letter = "Hi Ada,\n\nBest,\nJoel";

const signed = ensureEmailSignature(letter);
assert.equal(hasEmailSignature(signed), true);
assert.ok(signed.endsWith(EMAIL_SIGNATURE));
assert.equal(ensureEmailSignature(signed), signed);
assert.equal(ensureEmailSignature(signed).split(EMAIL_SIGNATURE).length - 1, 1);
assert.equal(stripEmailSignature(signed), letter);

const html = ensureEmailSignatureHtml("<html><body><p>Hi</p></body></html>");
assert.match(html, /Joel DeJong/);
assert.match(html, /American Songwriter/);
assert.ok(html.includes("</body>"));
assert.equal(ensureEmailSignatureHtml(html), html);

console.log("signature tests passed");
