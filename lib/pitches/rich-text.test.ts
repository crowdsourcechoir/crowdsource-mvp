import assert from "node:assert/strict";
import { pitchTextParts, plainPitchText, toggleBoldMarkup } from "./rich-text";

assert.deepEqual(pitchTextParts("Stories. **Hopes.** Connections."), [
  { bold: false, text: "Stories. " },
  { bold: true, text: "Hopes." },
  { bold: false, text: " Connections." },
]);
assert.equal(plainPitchText("Stories. **Hopes.** Connections."), "Stories. Hopes. Connections.");

const wrapped = toggleBoldMarkup("Stories. Hopes.", 9, 14);
assert.equal(wrapped.value, "Stories. **Hopes**.");
assert.equal(toggleBoldMarkup(wrapped.value, wrapped.start, wrapped.end).value, "Stories. Hopes.");
assert.equal(toggleBoldMarkup("Stories. **Hopes**.", 11, 16).value, "Stories. Hopes.");
assert.equal(toggleBoldMarkup("Open", 0, 0).value, "Open");

console.log("pitch rich text ok");
