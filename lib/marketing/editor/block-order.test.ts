// node --experimental-strip-types --import ./scripts/marketing/register-strip-types.mjs lib/marketing/editor/block-order.test.ts
import assert from "node:assert/strict";
import { insertBlock, moveBlock } from "./block-order";

const blocks = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

assert.deepEqual(
  insertBlock(blocks, { id: "n" }, 0).map((block) => block.id),
  ["n", "a", "b", "c", "d"]
);
assert.deepEqual(
  insertBlock(blocks, { id: "n" }, 2).map((block) => block.id),
  ["a", "b", "n", "c", "d"]
);
assert.deepEqual(
  insertBlock(blocks, { id: "n" }, 99).map((block) => block.id),
  ["a", "b", "c", "d", "n"]
);

assert.deepEqual(
  moveBlock(blocks, "c", 0).map((block) => block.id),
  ["c", "a", "b", "d"]
);
assert.deepEqual(
  moveBlock(blocks, "c", 1).map((block) => block.id),
  ["a", "c", "b", "d"]
);
assert.deepEqual(moveBlock(blocks, "c", 2), blocks);
assert.deepEqual(moveBlock(blocks, "c", 3), blocks);
assert.deepEqual(
  moveBlock(blocks, "c", 4).map((block) => block.id),
  ["a", "b", "d", "c"]
);
assert.deepEqual(moveBlock(blocks, "missing", 0), blocks);

console.log("email block order tests ok");
