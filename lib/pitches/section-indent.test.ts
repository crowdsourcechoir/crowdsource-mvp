import assert from "node:assert/strict";
import type { CopyBlock } from "@/app/sobeca-song-garden/content";
import { paragraphDrawsIndent, paragraphIndentChoice, sectionIndentDefault } from "./section-indent";

function at(blocks: CopyBlock[], text: string): number {
  const index = blocks.findIndex((block) => "text" in block && block.text === text);
  assert.ok(index >= 0, text);
  return index;
}

const slide: CopyBlock[] = [
  { type: "heading", text: "Investment" },
  { type: "heading2", text: "Price" },
  { type: "paragraph", text: "First" },
  { type: "paragraph", text: "Second" },
  { type: "list", items: ["Still in the section"] },
  { type: "paragraph", text: "After the list" },
  { type: "paragraph", text: "Barred", rule: true },
  { type: "heading3", text: "Included" },
  { type: "paragraph", text: "Under included" },
  { type: "paragraph", text: "Still included" },
  { type: "line", text: "Closer" },
  { type: "paragraph", text: "After the closer" },
  { type: "heading2", text: "Plain", indent: false },
  { type: "paragraph", text: "Flush" },
  { type: "paragraph", text: "Forced", indent: true },
  { type: "paragraph", text: "Ruled", rule: true },
];

assert.equal(paragraphDrawsIndent(slide, at(slide, "First")), true);
assert.equal(paragraphDrawsIndent(slide, at(slide, "Second")), true);
assert.equal(paragraphDrawsIndent(slide, at(slide, "After the list")), true);
assert.equal(paragraphIndentChoice(slide, at(slide, "Barred")), true);
assert.equal(paragraphDrawsIndent(slide, at(slide, "Barred")), false);
assert.equal(paragraphDrawsIndent(slide, at(slide, "Under included")), true);
assert.equal(paragraphDrawsIndent(slide, at(slide, "Still included")), true);
assert.equal(paragraphDrawsIndent(slide, at(slide, "After the closer")), false);
assert.equal(sectionIndentDefault(slide, at(slide, "Flush")), false);
assert.equal(paragraphDrawsIndent(slide, at(slide, "Flush")), false);
assert.equal(paragraphDrawsIndent(slide, at(slide, "Forced")), true);
assert.equal(paragraphDrawsIndent(slide, at(slide, "Ruled")), false);

const optedOut: CopyBlock[] = [
  { type: "heading2", text: "Price" },
  { type: "paragraph", text: "Stay", indent: false },
  { type: "paragraph", text: "Follows" },
];
assert.equal(paragraphDrawsIndent(optedOut, 1), false);
assert.equal(paragraphDrawsIndent(optedOut, 2), true);

console.log("pitch section indent ok");
