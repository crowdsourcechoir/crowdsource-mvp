import assert from "node:assert/strict";
import { confirmRareDelete } from "./confirm-rare-delete";

const prompts: string[] = [];
let answers: boolean[] = [];

(globalThis as { window: { confirm: (msg: string) => boolean } }).window = {
  confirm(msg: string) {
    prompts.push(msg);
    return answers[prompts.length - 1] ?? false;
  },
};

answers = [true, true];
assert.equal(confirmRareDelete("bloom", "Islandwood"), true);
assert.equal(prompts.length, 2);
assert.match(prompts[0], /Delete “Islandwood”/);
assert.match(prompts[1], /Really delete “Islandwood”/);

prompts.length = 0;
answers = [true, false];
assert.equal(confirmRareDelete("garden", "Ballard FC"), false);
assert.equal(prompts.length, 2);
assert.match(prompts[0], /Delete “Ballard FC”/);

prompts.length = 0;
answers = [false];
assert.equal(confirmRareDelete("bloom", "Populus"), false);
assert.equal(prompts.length, 1);

console.log("confirm-rare-delete tests passed");
