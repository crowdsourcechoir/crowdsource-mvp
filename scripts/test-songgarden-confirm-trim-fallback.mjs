/**
 * Unit checks for songgarden confirm trim-schema fallback shape.
 * Run: node scripts/test-songgarden-confirm-trim-fallback.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const confirmSrc = readFileSync(
  path.join(process.cwd(), "app/api/songgarden/upload/confirm/route.ts"),
  "utf8"
);

assert.equal(
  /audio_data_original:\s*null/.test(confirmSrc),
  false,
  "confirm insert must not set audio_data_original (Storage holds originals)"
);
assert.match(confirmSrc, /isTrimSchemaMissing/);
assert.match(confirmSrc, /CLIP_SELECT_NO_TRIM/);
assert.match(confirmSrc, /songgarden-trim-originals/);

function isTrimSchemaMissing(message) {
  return /audio_data_original|trim_lead_ms|trim_trail_ms|trim_status|has_original/i.test(message);
}

assert.equal(
  isTrimSchemaMissing(
    "Could not find the 'audio_data_original' column of 'songgarden_clips' in the schema cache"
  ),
  true
);

const insertRow = {
  event_id: "e1",
  audio_data: null,
  audio_storage_path: "clips/e1/a.wav",
  audio_original_storage_path: "clips/e1/a-orig.wav",
  trim_lead_ms: 10,
  trim_trail_ms: 20,
  trim_status: "trimmed",
  has_original: true,
};
const {
  trim_lead_ms: _l,
  trim_trail_ms: _t,
  trim_status: _s,
  has_original: _h,
  ...noTrimRow
} = insertRow;
assert.deepEqual(Object.keys(noTrimRow).sort(), [
  "audio_data",
  "audio_original_storage_path",
  "audio_storage_path",
  "event_id",
]);
assert.equal("audio_data_original" in noTrimRow, false);

console.log("ok: songgarden confirm trim fallback");
