/**
 * Smoke: unified Audio + optional composition category + recordSeconds.
 * Run: npx tsx scripts/test-journey-sound-duration.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const {
    normalizeJourneySteps,
    normalizePromptChannels,
    resolveSoundStep,
    resolvePromptRecordMs,
    createJourneySoundPromptStep,
    DEFAULT_FREE_SOUND_SECONDS,
    isAgentContributionStep,
  } = await load("lib/songgarden/journey-steps.ts");

  const free = createJourneySoundPromptStep(undefined, {
    prompt: "Say a phrase",
    recordSeconds: 10,
  });
  assert.equal(free.allowAudio, true);
  assert.equal(free.allowSound, true, "sound kept in sync with audio");
  assert.equal(free.slotId, undefined);
  assert.equal(free.recordSeconds, 10);
  assert.equal(resolvePromptRecordMs(free, "sound"), 10_000);
  assert.equal(isAgentContributionStep(free), false, "audio-only skips agent interview");

  const ambient = createJourneySoundPromptStep(undefined, {
    prompt: "Ambient world",
    recordSeconds: 30,
  });
  assert.equal(resolvePromptRecordMs(ambient, "sound"), 30_000);

  const resolved = resolveSoundStep(free);
  assert.ok(resolved);
  assert.equal(resolved.isFree, true);
  assert.equal(resolved.slotId, null);
  assert.equal(resolved.recordMs, 10_000);

  const tap = createJourneySoundPromptStep("tap", {
    prompt: "Tap",
    recordSeconds: 5,
  });
  assert.equal(tap.slotId, "tap");
  assert.equal(resolvePromptRecordMs(tap, "sound"), 5000);

  const voiceWithClap = createJourneySoundPromptStep("mid", {
    prompt: "Sing or clap",
    recordSeconds: 10,
    alternateSlotIds: ["clap"],
  });
  const resolvedAlt = resolveSoundStep(voiceWithClap);
  assert.ok(resolvedAlt?.alternateSlots?.some((s) => s.id === "clap"));
  assert.equal(resolvedAlt?.recordMs, 10_000);

  // Legacy sound-only migrates to unified audio
  const legacy = normalizeJourneySteps([
    {
      id: "legacy",
      kind: "prompt",
      prompt: "Old sound",
      allowSound: true,
      allowAudio: false,
      slotId: "stomp",
    },
  ]);
  assert.equal(legacy[0].allowAudio, true);
  assert.equal(legacy[0].allowSound, true);
  assert.equal(legacy[0].slotId, "stomp");

  // Legacy audio-only (interview) migrates to garden audio recording
  const legacyVoice = normalizeJourneySteps([
    {
      id: "voice",
      kind: "prompt",
      prompt: "Sing",
      allowAudio: true,
      allowSound: false,
      recordSeconds: 12,
    },
  ]);
  assert.equal(legacyVoice[0].allowAudio, true);
  assert.equal(legacyVoice[0].allowSound, true);
  assert.equal(legacyVoice[0].slotId, undefined);
  assert.equal(legacyVoice[0].recordSeconds, 12);
  assert.ok(resolveSoundStep(legacyVoice[0]));

  const channels = normalizePromptChannels({ allowAudio: true });
  assert.equal(channels.allowAudio, true);
  assert.equal(channels.allowSound, true);

  const normalized = normalizeJourneySteps([
    {
      id: "a",
      kind: "prompt",
      prompt: "Free",
      allowAudio: true,
      recordSeconds: 12,
    },
    {
      id: "b",
      kind: "prompt",
      prompt: "Also free",
      allowAudio: true,
      recordSeconds: 25,
    },
  ]);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].slotId, undefined);
  assert.equal(normalized[1].slotId, undefined);
  assert.equal(normalized[0].recordSeconds, 12);
  assert.equal(normalized[1].recordSeconds, 25);
  assert.equal(DEFAULT_FREE_SOUND_SECONDS, 10);

  console.log("ok — unified audio + optional composition category");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
