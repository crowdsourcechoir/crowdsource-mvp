/**
 * Smoke: pair agent questions with user answers; person-key helpers.
 * Run: npx tsx scripts/test-interview-qa-pairing.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const {
    pairInterviewAnswers,
    normalizePersonKey,
    isAnonymousPersonName,
  } = await load("lib/agent-interview-qa.ts");

  const answers = pairInterviewAnswers([
    { role: "agent", content: "What is your name?", turn_index: 0, created_at: "2026-01-01T00:00:00Z" },
    { role: "user", content: "Joel", turn_index: 1, created_at: "2026-01-01T00:00:01Z" },
    { role: "agent", content: "What brings you here?", turn_index: 2, created_at: "2026-01-01T00:00:02Z" },
    { role: "user", content: "Hdf", turn_index: 3, created_at: "2026-01-01T00:00:03Z", audio_url: "data:audio/wav;base64,xx" },
    { role: "user", content: "Jshdg", turn_index: 4, created_at: "2026-01-01T00:00:04Z" },
  ]);

  assert.equal(answers.length, 3);
  assert.equal(answers[0].questionText, "What is your name?");
  assert.equal(answers[0].content, "Joel");
  assert.equal(answers[1].questionText, "What brings you here?");
  assert.equal(answers[1].audioUrl, "data:audio/wav;base64,xx");
  // Second user turn without a new agent question keeps the previous question
  assert.equal(answers[2].questionText, "What brings you here?");

  assert.equal(normalizePersonKey("  Joel  "), "joel");
  assert.equal(isAnonymousPersonName("Anonymous"), true);
  assert.equal(isAnonymousPersonName("Joel"), false);

  console.log("ok — interview Q/A pairing");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
