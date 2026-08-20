/**
 * Smoke: Song Garden v2 prompt pads/wiring include TypewriterText.
 * Run: node scripts/test-prompt-typewriter-wiring.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [
  "components/TypewriterText.tsx",
  "components/song-garden-v2/MomentOverlay.tsx",
  "components/song-garden-v2/WorldJourney.tsx",
  "components/song-garden-v2/TextMomentPad.tsx",
  "components/song-garden-v2/VoiceMomentPad.tsx",
  "components/song-garden-v2/SoundMomentPad.tsx",
  "components/song-garden-v2/VideoMomentPad.tsx",
];

for (const rel of files) {
  const src = readFileSync(path.join(root, rel), "utf8");
  assert.match(src, /TypewriterText/, `${rel} should use TypewriterText`);
}

const typewriter = readFileSync(path.join(root, "components/TypewriterText.tsx"), "utf8");
assert.match(typewriter, /Reveals text character-by-character/);
assert.match(typewriter, /visibleLength/);

console.log("ok — Song Garden prompts wired to TypewriterText");
