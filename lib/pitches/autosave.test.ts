import assert from "node:assert/strict";
import { pitchDraftKey, shouldApplySavedDraft } from "./autosave";

const draft = {
  name: "Harbor",
  prompt: "Invite the room.",
  slides: [{ id: "title", blocks: [{ type: "paragraph", text: "Sing it." }] }],
};

assert.equal(pitchDraftKey(draft), pitchDraftKey(JSON.parse(JSON.stringify(draft))));
assert.equal(shouldApplySavedDraft(pitchDraftKey(draft), pitchDraftKey(draft)), true);

const newer = pitchDraftKey({ ...draft, name: "Harbor night" });
assert.equal(shouldApplySavedDraft(newer, pitchDraftKey(draft)), false);

console.log("pitch autosave ok");
