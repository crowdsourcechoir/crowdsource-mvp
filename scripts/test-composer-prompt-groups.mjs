/**
 * Composer text batches under the journey question, in the order asked.
 * Run: npx tsx scripts/test-composer-prompt-groups.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const { fillMissingJourneyQuestions, pairInterviewAnswers } = await load(
    "lib/agent-interview-qa.ts"
  );
  const { contributionQuestionPrompts } = await load("lib/songgarden/journey-steps.ts");
  const { groupAnswersByPrompt } = await load("lib/composer/group-answers-by-prompt.ts");

  const prompts = contributionQuestionPrompts([
    { id: "n", kind: "name", prompt: "What should we call you?" },
    {
      id: "s",
      kind: "prompt",
      prompt: "Add a stomp",
      allowText: false,
      allowAudio: true,
      allowSound: true,
      slotId: "stomp",
    },
    { id: "q", kind: "prompt", prompt: "What do you want this room to remember?", allowText: true },
  ]);
  assert.deepEqual(prompts, [
    "What should we call you?",
    "What do you want this room to remember?",
  ]);

  const paired = pairInterviewAnswers([
    { id: "u1", role: "user", content: "Joel", turn_index: 0, created_at: "2026-01-01T00:00:01Z" },
    { id: "u2", role: "user", content: "The quiet", turn_index: 1, created_at: "2026-01-01T00:00:02Z" },
  ]);
  assert.equal(paired[0].questionText, null);
  const filled = fillMissingJourneyQuestions(paired, prompts);
  assert.equal(filled[0].questionText, "What should we call you?");
  assert.equal(filled[1].questionText, "What do you want this room to remember?");

  const alreadyAsked = fillMissingJourneyQuestions(
    [{ questionText: "Stored question", content: "Hi" }],
    prompts
  );
  assert.equal(alreadyAsked[0].questionText, "Stored question");

  const groups = groupAnswersByPrompt([
    {
      id: "b",
      participantName: "Sam",
      questionText: "Second question",
      content: "Later",
      createdAt: "2026-02-01T00:00:00Z",
    },
    {
      id: "a",
      participantName: "Joel",
      questionText: "First question",
      content: "Earlier",
      createdAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "c",
      participantName: "Avery",
      questionText: "First question",
      content: "Also early",
      createdAt: "2026-01-02T00:00:00Z",
    },
  ]);
  assert.deepEqual(
    groups.map((g) => g.prompt),
    ["First question", "Second question"]
  );
  assert.deepEqual(
    groups[0].answers.map((a) => a.content),
    ["Earlier", "Also early"]
  );

  console.log("ok — composer prompt groups");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
