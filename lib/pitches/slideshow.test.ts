import assert from "node:assert/strict";
import type { CopyBlock } from "@/app/sobeca-song-garden/content";
import {
  bottomRepeatsCopy,
  clickBeatHidden,
  clickBeats,
  copySteps,
  nextDeckStep,
  nextPresentStep,
  pinnedLine,
  punchCopy,
  slideGesture,
  stepSlide,
} from "./slideshow";

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
assert.equal(punchCopy(withLine), null);
assert.equal(punchCopy(withLine, "  ") , null);
assert.equal(punchCopy(withLine, " Any closer ")?.text, "Any closer");
assert.equal(punchCopy(withLine, "Any closer")?.index, -1);
assert.deepEqual(pinnedLine({ blocks: withLine }), { index: 2, text: "The potential is already in the room." });
assert.equal(
  pinnedLine({
    blocks: [
      { type: "line", text: "In the room." },
      { type: "paragraph", text: "Then more." },
    ],
  }),
  null,
);
assert.equal(pinnedLine({ reveal: "steps", blocks: withLine }), null);

const sentence: CopyBlock[] = [
  { type: "heading2", text: "Live facilitation" },
  {
    type: "paragraph",
    text: "Lead an accessible, high-energy experience with live music and lyric projection.",
  },
];
assert.equal(punchCopy(sentence), null);
assert.equal(punchCopy([{ type: "heading", text: "Participation changes the equation." }, { type: "table", headers: ["A"], rows: [["B"]] }]), null);
assert.equal(
  punchCopy([
    { type: "heading", text: "What changes" },
    { type: "heading2", text: "The audience writes the line." },
    { type: "heading2", text: "The room sings it back." },
  ]),
  null
);

assert.deepEqual(nextDeckStep({ index: 1, revealed: false }, 9, "next", true, false), { index: 1, revealed: true });
assert.deepEqual(nextDeckStep({ index: 1, revealed: true }, 9, "next", true, false), { index: 2, revealed: false });
assert.deepEqual(nextDeckStep({ index: 3, revealed: false }, 9, "next", false, false), { index: 4, revealed: false });
assert.deepEqual(nextDeckStep({ index: 1, revealed: true }, 9, "prev", true, true), { index: 1, revealed: false });
assert.deepEqual(nextDeckStep({ index: 2, revealed: false }, 9, "prev", true, true), { index: 1, revealed: true });
assert.deepEqual(nextDeckStep({ index: 8, revealed: true }, 9, "next", true, false), { index: 8, revealed: true });

const paced: CopyBlock[] = [
  { type: "heading", text: "With you" },
  { type: "list", items: ["One voice", " ", "The room"] },
  { type: "table", headers: ["When", "What"], rows: [["Open", "Arrive"], ["Close", "Sing"]] },
];
assert.deepEqual(copySteps(paced), [
  { blockIndex: 0 },
  { blockIndex: 1, itemIndex: 0 },
  { blockIndex: 1, itemIndex: 2 },
  { blockIndex: 2, rowIndex: 0 },
  { blockIndex: 2, rowIndex: 1 },
]);

const stepped = [
  { reveal: "steps", blocks: paced, bottom: "After the steps" },
  { blocks: withLine, bottom: "Held for the click" },
];
assert.deepEqual(nextPresentStep({ index: 0, revealed: false, arrived: 0 }, stepped, "next"), {
  index: 0,
  revealed: false,
  arrived: 1,
});
assert.deepEqual(nextPresentStep({ index: 0, revealed: false, arrived: 5 }, stepped, "next"), {
  index: 0,
  revealed: true,
  arrived: 5,
});
assert.deepEqual(nextPresentStep({ index: 0, revealed: true, arrived: 5 }, stepped, "next"), {
  index: 1,
  revealed: false,
  arrived: 0,
});
assert.deepEqual(nextPresentStep({ index: 0, revealed: true, arrived: 5 }, stepped, "prev"), {
  index: 0,
  revealed: false,
  arrived: 5,
});
assert.deepEqual(nextPresentStep({ index: 0, revealed: false, arrived: 2 }, stepped, "prev"), {
  index: 0,
  revealed: false,
  arrived: 1,
});
assert.deepEqual(nextPresentStep({ index: 1, revealed: false, arrived: 0 }, stepped, "prev"), {
  index: 0,
  revealed: true,
  arrived: 5,
});
assert.deepEqual(nextPresentStep({ index: 1, revealed: false, arrived: 0 }, stepped, "next"), {
  index: 1,
  revealed: true,
  arrived: 0,
});

const sameAsLine = [
  { blocks: withLine, bottom: "The potential is already in the room." },
  { blocks: [{ type: "heading" as const, text: "Next" }] },
];
assert.deepEqual(nextPresentStep({ index: 0, revealed: false, arrived: 0 }, sameAsLine, "next"), {
  index: 1,
  revealed: false,
  arrived: 0,
});
const differentBottom = [
  { blocks: withLine, bottom: "A different closer." },
  { blocks: [{ type: "heading" as const, text: "Next" }] },
];
assert.deepEqual(nextPresentStep({ index: 0, revealed: false, arrived: 0 }, differentBottom, "next"), {
  index: 0,
  revealed: true,
  arrived: 0,
});

const marked: CopyBlock[] = [
  { type: "heading", text: "Visible now." },
  { type: "paragraph", text: "First click.", click: true },
  { type: "paragraph", text: "Second click.", click: true },
  { type: "line", text: "Held line.", click: true },
];
assert.deepEqual(clickBeats(marked), [{ blockIndex: 1 }, { blockIndex: 2 }, { blockIndex: 3 }]);
assert.equal(pinnedLine({ blocks: marked }), null);
assert.equal(clickBeatHidden(clickBeats(marked), 1, undefined, 0), true);
assert.equal(clickBeatHidden(clickBeats(marked), 1, undefined, 1), false);
assert.equal(clickBeatHidden(clickBeats(marked), 0, undefined, 0), false);

const many = [
  { blocks: marked, bottom: "After the rows." },
  { blocks: [{ type: "heading" as const, text: "Next" }] },
];
assert.deepEqual(nextPresentStep({ index: 0, revealed: false, arrived: 0 }, many, "next"), {
  index: 0,
  revealed: false,
  arrived: 1,
});
assert.deepEqual(nextPresentStep({ index: 0, revealed: false, arrived: 2 }, many, "next"), {
  index: 0,
  revealed: false,
  arrived: 3,
});
assert.deepEqual(nextPresentStep({ index: 0, revealed: false, arrived: 3 }, many, "next"), {
  index: 0,
  revealed: true,
  arrived: 3,
});
assert.deepEqual(nextPresentStep({ index: 0, revealed: true, arrived: 3 }, many, "next"), {
  index: 1,
  revealed: false,
  arrived: 0,
});
assert.deepEqual(nextPresentStep({ index: 1, revealed: false, arrived: 0 }, many, "prev"), {
  index: 0,
  revealed: true,
  arrived: 3,
});
assert.deepEqual(nextPresentStep({ index: 0, revealed: true, arrived: 3 }, many, "prev"), {
  index: 0,
  revealed: false,
  arrived: 3,
});

const repeatedParagraph: CopyBlock[] = [
  { type: "heading", text: "Anthem. Made for the moment." },
  {
    type: "paragraph",
    text: "Our signature Anthem Experience transforms the people, purpose, and place behind a gathering into an original song.",
  },
  { type: "line", text: "They don’t just hear it. They sing it." },
];
const repeated = [
  { reveal: "steps" as const, blocks: repeatedParagraph, bottom: repeatedParagraph[1] && "text" in repeatedParagraph[1] ? repeatedParagraph[1].text : "" },
  { blocks: [{ type: "heading" as const, text: "Next" }] },
];
assert.equal(bottomRepeatsCopy(repeated[0]), true);
assert.deepEqual(nextPresentStep({ index: 0, revealed: false, arrived: 3 }, repeated, "next"), {
  index: 1,
  revealed: false,
  arrived: 0,
});

const listMarked: CopyBlock[] = [{ type: "list", items: ["Stay", "First", "Second"], clickItems: [2, 1] }];
assert.deepEqual(clickBeats(listMarked), [
  { blockIndex: 0, itemIndex: 1 },
  { blockIndex: 0, itemIndex: 2 },
]);

console.log("slideshow gesture ok");
