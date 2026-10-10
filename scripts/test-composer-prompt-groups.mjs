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
  const { fillMissingJourneyQuestions, pairInterviewAnswers, presentInterviewConversation } =
    await load("lib/agent-interview-qa.ts");
  const { contributionQuestionPrompts, contributionPrompts } = await load(
    "lib/songgarden/journey-steps.ts"
  );
  const { isIncomingNameStep } = await load("lib/agent-name-question.ts");
  const { groupAnswersByPrompt, answersToPersonTable } = await load(
    "lib/composer/group-answers-by-prompt.ts"
  );

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

  const table = answersToPersonTable([
    {
      id: "1",
      participantName: "Brittany",
      questionText: "Place in nature you feel most renewed",
      content: "Near the ocean",
      createdAt: "2026-03-01T00:00:00Z",
      conversationId: "c1",
    },
    {
      id: "2",
      participantName: "Brittany",
      questionText: "What do you feel in a circle of friends?",
      content: "Joy",
      createdAt: "2026-03-01T00:00:01Z",
      conversationId: "c1",
    },
    {
      id: "3",
      participantName: "Jess",
      questionText: "Place in nature you feel most renewed",
      content: "On a mountaintop!",
      createdAt: "2026-03-01T00:00:02Z",
      conversationId: "c2",
    },
    {
      id: "4",
      participantName: "Mary",
      questionText: "Place in nature you feel most renewed",
      content: "(photo)",
      createdAt: "2026-03-01T00:00:03Z",
      conversationId: "c3",
    },
  ]);
  assert.deepEqual(
    table.columns.map((column) => column.prompt),
    ["Place in nature you feel most renewed", "What do you feel in a circle of friends?"]
  );
  assert.deepEqual(
    table.rows.map((row) => row.name),
    ["Brittany", "Jess"]
  );
  assert.equal(table.rows[0].cells[table.columns[1].key][0].content, "Joy");
  assert.equal(table.rows[1].cells[table.columns[1].key], undefined);

  // Historical managed journeys store only user turns. The name is one of
  // those turns, and the participant row stayed Anonymous.
  const wfeaSteps = [
    { id: "n", kind: "name", prompt: "What should we call you?" },
    {
      id: "q",
      kind: "prompt",
      prompt: "What do you want to learn here?",
      allowText: true,
    },
    {
      id: "p",
      kind: "prompt",
      prompt: "Show us a photo.",
      allowText: false,
      allowPhoto: true,
    },
    {
      id: "s",
      kind: "prompt",
      prompt: "Record a sound from the room.",
      allowText: false,
      allowAudio: true,
      allowSound: true,
    },
  ];
  const wfeaPrompts = contributionPrompts(wfeaSteps);
  assert.deepEqual(
    wfeaPrompts.map((item) => item.prompt),
    ["What should we call you?", "What do you want to learn here?", "Show us a photo."]
  );
  assert.equal(wfeaPrompts[0].isName, true);
  assert.equal(wfeaPrompts[1].isName, false);

  function anonymousConversation(turns) {
    return presentInterviewConversation({
      participantName: "Anonymous",
      answers: pairInterviewAnswers(turns),
      prompts: wfeaPrompts,
    });
  }

  const joel = anonymousConversation([
    { id: "j1", role: "user", content: "Joel", turn_index: 0, created_at: "2026-04-01T00:00:01Z" },
    {
      id: "j2",
      role: "user",
      content: "I'd like to meet a producer and talk about big dreams",
      turn_index: 1,
      created_at: "2026-04-01T00:00:02Z",
    },
    { id: "j3", role: "user", content: "(photo)", turn_index: 2, created_at: "2026-04-01T00:00:03Z" },
  ]);
  assert.equal(joel.participantName, "Joel");
  assert.equal(joel.answers[0].isNameAnswer, true);
  assert.equal(joel.answers[1].isNameAnswer, false);
  assert.equal(joel.answers[1].questionText, "What do you want to learn here?");
  assert.equal(joel.answers[2].questionText, "Show us a photo.");

  const jeremy = anonymousConversation([
    {
      id: "m1",
      role: "user",
      content: "Jeremy Gilchrist",
      turn_index: 0,
      created_at: "2026-04-01T00:01:01Z",
    },
    {
      id: "m2",
      role: "user",
      content: "Learned when to use AI to assist our work, and also to not over use it.",
      turn_index: 1,
      created_at: "2026-04-01T00:01:02Z",
    },
  ]);
  const lana = anonymousConversation([
    { id: "l1", role: "user", content: "Lana", turn_index: 0, created_at: "2026-04-01T00:02:01Z" },
  ]);
  const noName = presentInterviewConversation({
    participantName: "Anonymous",
    answers: pairInterviewAnswers([
      {
        id: "x1",
        role: "user",
        content: "I skipped the name and only answered this.",
        turn_index: 0,
        created_at: "2026-04-01T00:03:01Z",
      },
    ]),
    prompts: contributionPrompts([
      { id: "q", kind: "prompt", prompt: "What do you want to learn here?", allowText: true },
    ]),
  });
  assert.equal(noName.participantName, "Anonymous");
  assert.equal(noName.answers[0].isNameAnswer, false);
  assert.equal(noName.answers[0].questionText, "What do you want to learn here?");

  const kept = presentInterviewConversation({
    participantName: "Claire",
    answers: pairInterviewAnswers([
      {
        id: "c1",
        role: "user",
        content: "I want to grow as a consultant.",
        turn_index: 0,
        created_at: "2026-04-01T00:04:01Z",
      },
    ]),
    prompts: wfeaPrompts,
  });
  assert.equal(kept.participantName, "Claire");

  const namedLater = presentInterviewConversation({
    participantName: null,
    answers: pairInterviewAnswers([
      { id: "a1", role: "user", content: "The quiet", turn_index: 0, created_at: "2026-04-02T00:00:01Z" },
      { id: "a2", role: "user", content: "Dr. Trevor Lane", turn_index: 1, created_at: "2026-04-02T00:00:02Z" },
    ]),
    prompts: contributionPrompts([
      { id: "q", kind: "prompt", prompt: "What do you want to learn here?", allowText: true },
      { id: "n", kind: "name", prompt: "What should we call you?" },
    ]),
  });
  assert.equal(namedLater.participantName, "Dr. Trevor Lane");
  assert.equal(namedLater.answers[0].questionText, "What do you want to learn here?");
  assert.equal(namedLater.answers[1].isNameAnswer, true);

  const photoIsNotAName = anonymousConversation([
    { id: "p1", role: "user", content: "(photo)", turn_index: 0, created_at: "2026-04-03T00:00:01Z" },
    { id: "p2", role: "user", content: "Bruce Skinner", turn_index: 1, created_at: "2026-04-03T00:00:02Z" },
  ]);
  assert.equal(photoIsNotAName.participantName, "Anonymous");

  const organized = answersToPersonTable([
    ...joel.answers.map((answer) => ({
      id: answer.turnId,
      participantName: joel.participantName,
      questionText: answer.questionText,
      content: answer.content,
      createdAt: answer.createdAt,
      conversationId: "joel",
      isNameAnswer: answer.isNameAnswer,
    })),
    ...jeremy.answers.map((answer) => ({
      id: answer.turnId,
      participantName: jeremy.participantName,
      questionText: answer.questionText,
      content: answer.content,
      createdAt: answer.createdAt,
      conversationId: "jeremy",
      isNameAnswer: answer.isNameAnswer,
    })),
    ...lana.answers.map((answer) => ({
      id: answer.turnId,
      participantName: lana.participantName,
      questionText: answer.questionText,
      content: answer.content,
      createdAt: answer.createdAt,
      conversationId: "lana",
      isNameAnswer: answer.isNameAnswer,
    })),
  ]);
  assert.deepEqual(
    organized.columns.map((column) => column.prompt),
    ["What do you want to learn here?"]
  );
  assert.deepEqual(
    organized.rows.map((row) => row.name),
    ["Joel", "Jeremy Gilchrist"]
  );
  assert.equal(
    organized.rows[0].cells[organized.columns[0].key][0].content,
    "I'd like to meet a producer and talk about big dreams"
  );
  assert.equal(
    organized.rows[1].cells[organized.columns[0].key][0].content,
    "Learned when to use AI to assist our work, and also to not over use it."
  );

  assert.equal(
    isIncomingNameStep({
      journeyNameStep: true,
      lastAgentContent: "What do you want to learn here?",
      questionPrompt: "What should we call you?",
      brief: { collectName: true },
    }),
    true
  );
  assert.equal(
    isIncomingNameStep({
      journeyNameStep: false,
      lastAgentContent: "What do you want to learn here?",
      questionPrompt: "",
      brief: { collectName: true },
    }),
    false
  );

  console.log("ok — composer prompt groups");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
