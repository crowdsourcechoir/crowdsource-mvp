import assert from "node:assert/strict";
import {
  DEFAULT_SELFIE_MEDIA_BLOCK,
  DEFAULT_SNAP_MEDIA_BLOCK,
  isMediaPromptBlock,
  parsePromptBlock,
} from "@/data/signalPromptBlock";
import { isDisplayableSubmission } from "@/lib/live-prompt-game/rows";
import type { PromptGameSubmission } from "@/data/livePromptGame";

function sub(partial: Partial<PromptGameSubmission>): PromptGameSubmission {
  return {
    id: "1",
    session_id: "s",
    round_id: "r",
    device_id: "d",
    raw_text: "[selfie]",
    created_at: new Date().toISOString(),
    hidden: false,
    locked: false,
    media_type: "photo",
    media_url: "https://example.com/a.jpg",
    approved: false,
    ...partial,
  };
}

async function main() {
  assert.equal(parsePromptBlock(DEFAULT_SELFIE_MEDIA_BLOCK)?.kind, "media");
  assert.equal(parsePromptBlock(DEFAULT_SNAP_MEDIA_BLOCK)?.kind, "media");
  assert.ok(isMediaPromptBlock(parsePromptBlock(DEFAULT_SELFIE_MEDIA_BLOCK)));
  assert.equal(parsePromptBlock({ version: 1, kind: "media", mediaType: "nope" }), null);

  assert.equal(isDisplayableSubmission(sub({}), "auto"), true);
  assert.equal(isDisplayableSubmission(sub({ hidden: true }), "auto"), false);
  assert.equal(isDisplayableSubmission(sub({ approved: false }), "approve_first"), false);
  assert.equal(isDisplayableSubmission(sub({ approved: true }), "approve_first"), true);
  assert.equal(isDisplayableSubmission(sub({ media_url: null }), "auto"), false);

  console.log("live media-moments tests passed");
}

void main();
