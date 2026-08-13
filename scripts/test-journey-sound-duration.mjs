/**
 * Smoke: free sound + per-prompt recordSeconds.
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
    resolveSoundStep,
    resolvePromptRecordMs,
    createJourneySoundPromptStep,
    DEFAULT_FREE_SOUND_SECONDS,
  } = await load("lib/songgarden/journey-steps.ts");

  const free = createJourneySoundPromptStep(undefined, {
    prompt: "Say a phrase",
    recordSeconds: 10,
  });
  assert.equal(free.allowSound, true);
  assert.equal(free.slotId, undefined);
  assert.equal(free.recordSeconds, 10);
  assert.equal(resolvePromptRecordMs(free, "sound"), 10_000);

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

  const stomp = createJourneySoundPromptStep("stomp", { prompt: "Stomp" });
  assert.equal(stomp.slotId, "stomp");
  // Pad default ~1.8s when no recordSeconds
  assert.ok(resolvePromptRecordMs(stomp, "sound") < 3000);
  const stompLong = createJourneySoundPromptStep("stomp", {
    prompt: "Long stomp",
    recordSeconds: 8,
  });
  assert.equal(resolvePromptRecordMs(stompLong, "sound"), 8000);

  const normalized = normalizeJourneySteps([
    {
      id: "a",
      kind: "prompt",
      prompt: "Free",
      allowSound: true,
      recordSeconds: 12,
    },
    {
      id: "b",
      kind: "prompt",
      prompt: "Also free",
      allowSound: true,
      recordSeconds: 25,
    },
  ]);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].slotId, undefined);
  assert.equal(normalized[1].slotId, undefined);
  assert.equal(normalized[0].recordSeconds, 12);
  assert.equal(normalized[1].recordSeconds, 25);
  assert.equal(DEFAULT_FREE_SOUND_SECONDS, 10);

  console.log("ok — free sound + recordSeconds");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
