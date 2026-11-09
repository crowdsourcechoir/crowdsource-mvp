import assert from "node:assert/strict";
import { acceptSlides } from "./model";
import {
  addListBlock,
  addListItem,
  addTableBlock,
  addTableRow,
  addTextBlock,
  insertSlide,
  moveBlock,
  moveSlide,
  newSlide,
  removeBlock,
  removeListItem,
  removeSlide,
  removeTableRow,
} from "./structure";

const photo = { image: "/pitch/library/conductor.jpg", imageAlt: "A conductor" };
const start = [
  {
    id: "title",
    ...photo,
    blocks: [{ type: "heading" as const, text: "Open" }],
  },
  {
    id: "close",
    ...photo,
    blocks: [
      { type: "paragraph" as const, text: "End" },
      { type: "list" as const, items: ["One"] },
      { type: "table" as const, headers: ["A", "B"], rows: [["1", "2"]] },
    ],
  },
];

const inserted = insertSlide(start, "title");
if ("error" in inserted) throw new Error(inserted.error);
assert.deepEqual(
  inserted.slides.map((slide) => slide.id),
  ["title", inserted.id, "close"]
);
assert.equal(acceptSlides(inserted.slides)?.length, 3);
assert.equal(acceptSlides([newSlide("slide-9")])?.[0]?.blocks[0]?.type, "heading");

const appended = insertSlide(start, null);
assert.ok(!("error" in appended) && appended.slides.at(-1)?.id === appended.id);

const removed = removeSlide(inserted.slides, inserted.id ?? "");
if ("error" in removed) throw new Error(removed.error);
assert.deepEqual(
  removed.slides.map((slide) => slide.id),
  ["title", "close"]
);
assert.equal("error" in removeSlide([start[0]!], "title"), true);

const moved = moveSlide(start, "close", -1);
if ("error" in moved) throw new Error(moved.error);
assert.deepEqual(
  moved.slides.map((slide) => slide.id),
  ["close", "title"]
);

const text = addTextBlock(start, "title", "line");
if ("error" in text) throw new Error(text.error);
assert.equal(text.slides[0]?.blocks[1]?.type, "line");
const shifted = moveBlock(text.slides, "title", 1, -1);
if ("error" in shifted) throw new Error(shifted.error);
assert.equal(shifted.slides[0]?.blocks[0]?.type, "line");
assert.equal("error" in removeBlock(start, "title", 0), true);
const withoutParagraph = removeBlock(text.slides, "title", 0);
if ("error" in withoutParagraph) throw new Error(withoutParagraph.error);
assert.equal(withoutParagraph.slides[0]?.blocks.length, 1);

const listed = addListBlock(start, "title");
if ("error" in listed) throw new Error(listed.error);
const listIndex = listed.slides[0]!.blocks.length - 1;
const longer = addListItem(listed.slides, "title", listIndex);
if ("error" in longer) throw new Error(longer.error);
const list = longer.slides[0]?.blocks[listIndex];
assert.equal(list?.type === "list" ? list.items.length : 0, 2);
assert.equal("error" in removeListItem(listed.slides, "title", listIndex, 0), true);

const tabled = addTableBlock(start, "title");
if ("error" in tabled) throw new Error(tabled.error);
const tableIndex = tabled.slides[0]!.blocks.length - 1;
const rowed = addTableRow(tabled.slides, "title", tableIndex);
if ("error" in rowed) throw new Error(rowed.error);
const table = rowed.slides[0]?.blocks[tableIndex];
assert.equal(table?.type === "table" ? table.rows.length : 0, 2);
assert.equal("error" in removeTableRow(tabled.slides, "title", tableIndex, 0), true);

const full = Array.from({ length: 40 }, (_, index) => ({
  id: `slide-${index + 1}`,
  ...photo,
  blocks: [{ type: "line" as const, text: "Full" }],
}));
assert.equal("error" in insertSlide(full, null), true);

console.log("pitch structure tests ok");
