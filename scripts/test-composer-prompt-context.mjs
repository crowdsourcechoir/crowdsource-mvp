/**
 * Composer text groups must show the journey prompt, then each person's answer.
 * Run: npx tsx scripts/test-composer-prompt-context.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const { pairInterviewAnswers } = await load("lib/agent-interview-qa.ts");
  const { readJourneyPrompt } = await load("lib/agent-journey-managed.ts");
  const {
    attributeMissingAnswerPrompts,
    contributionPromptsForComposer,
  } = await load("lib/composer/attribute-journey-prompts.ts");
  const { groupAnswersByPrompt, promptLabel } = await load("lib/composer/group-answers-by-prompt.ts");

  const event = {
    songGardenConfig: {
      journeySteps: [
        { id: "name", kind: "name", prompt: "What should we call you?" },
        { id: "memory", kind: "prompt", prompt: "A memory you love", allowText: true },
        {
          id: "sound",
          kind: "prompt",
          prompt: "Record a sound from the world around you.",
          allowText: false,
          allowAudio: true,
          allowSound: true,
        },
        { id: "feeling", kind: "prompt", prompt: "A feeling", allowText: true },
      ],
    },
  };

  const prompts = contributionPromptsForComposer(event);
  assert.deepEqual(prompts, ["What should we call you?", "A memory you love", "A feeling"]);
  assert.deepEqual(contributionPromptsForComposer({}), []);
  assert.deepEqual(contributionPromptsForComposer(null), []);

  const paired = pairInterviewAnswers([
    { role: "user", content: "June", turn_index: 0, created_at: "2026-06-01T00:00:00Z" },
    { role: "user", content: "Kayaking on the lake", turn_index: 1, created_at: "2026-06-01T00:00:01Z" },
    { role: "user", content: "Wind chimes, fall breeze", turn_index: 2, created_at: "2026-06-01T00:00:02Z" },
  ]);
  assert.equal(paired.every((answer) => answer.questionText == null), true);

  const attributed = attributeMissingAnswerPrompts(paired, prompts);
  assert.equal(attributed[0].questionText, "What should we call you?");
  assert.equal(attributed[1].questionText, "A memory you love");
  assert.equal(attributed[2].questionText, "A feeling");
  assert.deepEqual(
    attributed.map((answer) => answer.promptIndex),
    [0, 1, 2]
  );

  const stored = attributeMissingAnswerPrompts(
    [
      { questionText: null, content: "Ada" },
      { questionText: "A feeling", content: "Hope" },
    ],
    prompts
  );
  assert.equal(stored[0].questionText, "What should we call you?");
  assert.equal(stored[1].questionText, "A feeling");
  assert.equal(stored[1].promptIndex, 2);

  assert.equal(promptLabel(null), "Prompt not recorded");
  assert.equal(readJourneyPrompt({ journeyPrompt: "  A feeling  " }), "A feeling");
  assert.equal(readJourneyPrompt({}), "");

  const groups = groupAnswersByPrompt([
    {
      id: "b",
      participantName: "Anonymous",
      questionText: "A feeling",
      content: "a feeling",
      createdAt: "2026-06-01T00:00:02Z",
      promptIndex: 2,
    },
    {
      id: "a",
      participantName: "June",
      questionText: "A memory you love",
      content: "Kayaking on the lake",
      createdAt: "2026-06-01T00:00:01Z",
      promptIndex: 1,
    },
    {
      id: "c",
      participantName: "",
      questionText: "A memory you love",
      content: "The beach",
      createdAt: "2026-06-02T00:00:01Z",
      promptIndex: 1,
    },
  ]);

  assert.deepEqual(
    groups.map((group) => group.prompt),
    ["A memory you love", "A feeling"]
  );
  assert.deepEqual(
    groups[0].answers.map((answer) => answer.participantName),
    ["June", ""]
  );
  assert.equal(groups[0].answers[0].content, "Kayaking on the lake");
  assert.equal(groups[0].answers[1].content, "The beach");

  console.log("ok — composer prompt context");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
