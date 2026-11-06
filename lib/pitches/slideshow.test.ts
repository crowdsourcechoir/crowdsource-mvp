import assert from "node:assert/strict";
import type { CopyBlock } from "@/app/sobeca-song-garden/content";
import { nextDeckStep, punchCopy, slideGesture, stepSlide } from "./slideshow";

const width = 1000;

assert.equal(slideGesture({ dx: 0, dy: 0, x: 800, width, interactive: false }), "next");
assert.equal(slideGesture({ dx: 2, dy: 1, x: 100, width, interactive: false }), "prev");
assert.equal(slideGesture({ dx: 0, dy: 0, x: 100, width, interactive: true }), "none");
assert.equal(slideGesture({ dx: -80, dy: 10, x: 400, width, interactive: false }), "next");
assert.equal(slideGesture({ dx: 90, dy: 12, x: 400, width, interactive: false }), "prev");
assert.equal(slideGesture({ dx: -20, dy: 80, x: 400, width, interactive: false }), "none");

assert.equal(stepSlide(0, 9, "prev"), 0);
assert.equal(stepSlide(0, 9, "next"), 1);
assert.equal(stepSlide(8, 9, "next"), 8);

const withLine: CopyBlock[] = [
  { type: "heading", text: "We are the instruments." },
  { type: "paragraph", text: "Every audience holds a field of collective potential." },
  { type: "line", text: "The potential is already in the room." },
];
assert.equal(punchCopy(withLine)?.text, "The potential is already in the room.");
assert.equal(punchCopy(withLine)?.index, 2);

const sentence: CopyBlock[] = [
  { type: "heading", text: "Your audience is your greatest untapped creative resource." },
  { type: "paragraph", text: "What happens when you invite them to create something together?" },
  { type: "paragraph", text: "You unlock a different level of engagement, connection, and ownership." },
];
assert.equal(punchCopy(sentence)?.text, "You unlock a different level of engagement, connection, and ownership.");
assert.equal(punchCopy([{ type: "heading", text: "Participation changes the equation." }, { type: "table", headers: ["A"], rows: [["B"]] }]), null);

assert.deepEqual(nextDeckStep({ index: 1, revealed: false }, 9, "next", true, false), { index: 1, revealed: true });
assert.deepEqual(nextDeckStep({ index: 1, revealed: true }, 9, "next", true, false), { index: 2, revealed: false });
assert.deepEqual(nextDeckStep({ index: 3, revealed: false }, 9, "next", false, false), { index: 4, revealed: false });
assert.deepEqual(nextDeckStep({ index: 1, revealed: true }, 9, "prev", true, true), { index: 1, revealed: false });
assert.deepEqual(nextDeckStep({ index: 2, revealed: false }, 9, "prev", true, true), { index: 1, revealed: true });
assert.deepEqual(nextDeckStep({ index: 8, revealed: true }, 9, "next", true, false), { index: 8, revealed: true });

console.log("slideshow gesture ok");
