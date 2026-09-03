/**
 * Smoke: managed WorldJourney first turn (name step) must not 400.
 * Run: USE_LOCAL_EVENTS=true OPENAI_API_KEY=sk-test node scripts/test-journey-first-turn.mjs
 */
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

async function json(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  const slug = `journey-test-${Date.now()}`;
  const created = await json("POST", "/api/events", {
    slug,
    title: "Journey First Turn Test",
    description: "test",
    date: "2026-09-01",
    time: "12:00",
    venue: "Test",
    address: "Test",
    prompt: "test",
    heroImage: "",
    heroImageMode: "color",
    landingHeadline: "Test",
    landingCopy: "Test",
    ctaText: "Start",
    anthemCompletionMessage: "Done",
    allowAudioVideoPrompt: false,
    journeySteps: [
      {
        id: "name",
        kind: "prompt",
        label: "YOUR NAME",
        prompt: "If we reference your contribution, how would you like to be identified?",
        channels: { text: true },
        nameStep: true,
      },
      {
        id: "q1",
        kind: "prompt",
        label: "QUESTION",
        prompt: "What moment stands out?",
        channels: { text: true },
      },
    ],
    agentBrief: {
      collectName: true,
      nameQuestion: "If we reference your contribution, how would you like to be identified?",
    },
  });

  if (created.status >= 400) {
    throw new Error(`create event failed: ${created.status} ${JSON.stringify(created.data)}`);
  }

  const eventId = created.data?.id ?? created.data?.event?.id;
  if (!eventId) throw new Error(`no event id: ${JSON.stringify(created.data)}`);

  const sessionToken = `tok_${Date.now()}`;
  const started = await json("POST", "/api/agent/participants", {
    eventId,
    sessionToken,
  });
  if (started.status >= 400) {
    throw new Error(`start interview failed: ${started.status} ${JSON.stringify(started.data)}`);
  }

  const conversationId = started.data?.conversation?.id;
  if (!conversationId) throw new Error(`no conversation: ${JSON.stringify(started.data)}`);

  const sent = await json("POST", `/api/agent/conversations/${conversationId}/send`, {
    content: "Joel",
    journeyManaged: true,
    journeyNameStep: true,
    deviceId: "dev_testscript01",
  });

  if (sent.status >= 400) {
    throw new Error(`first name turn failed: ${sent.status} ${JSON.stringify(sent.data)}`);
  }

  if (sent.data?.nextMessage?.stopReason !== "journey_managed") {
    throw new Error(`expected journey_managed stub: ${JSON.stringify(sent.data?.nextMessage)}`);
  }

  console.log("ok: journey first turn", {
    eventId,
    conversationId,
    stopReason: sent.data.nextMessage.stopReason,
    turnRole: sent.data.turn?.role,
  });

  // Brief-synthesized steps (no journeySteps in songGardenConfig) — production conference pattern.
  const slug2 = `journey-brief-${Date.now()}`;
  const briefOnly = await json("POST", "/api/events", {
    slug: slug2,
    title: "Brief-only Journey Test",
    description: "test",
    date: "2026-09-01",
    time: "12:00",
    venue: "Test",
    address: "Test",
    prompt: "test",
    heroImage: "",
    heroImageMode: "color",
    landingHeadline: "Test",
    landingCopy: "Test",
    ctaText: "Start",
    anthemCompletionMessage: "Done",
    allowAudioVideoPrompt: false,
    agentBrief: {
      collectName: false,
      askAboutItems: [
        {
          prompt:
            "What is a source of renewal for you? A person. A place. A practice. A memory. A sound.",
          phaseLabel: "YOUR RENEWAL",
        },
      ],
    },
  });
  if (briefOnly.status >= 400) {
    throw new Error(`create brief event failed: ${briefOnly.status} ${JSON.stringify(briefOnly.data)}`);
  }
  const eventId2 = briefOnly.data?.id ?? briefOnly.data?.event?.id;
  const started2 = await json("POST", "/api/agent/participants", {
    eventId: eventId2,
    sessionToken: `tok_${Date.now()}`,
  });
  const conversationId2 = started2.data?.conversation?.id;
  const sent2 = await json("POST", `/api/agent/conversations/${conversationId2}/send`, {
    content: "Morning walks by the river",
    journeyManaged: true,
    deviceId: "dev_testscript02",
  });
  if (sent2.status >= 400) {
    throw new Error(`brief-only first turn failed: ${sent2.status} ${JSON.stringify(sent2.data)}`);
  }
  console.log("ok: brief-synthesized journey first turn", {
    eventId: eventId2,
    stopReason: sent2.data?.nextMessage?.stopReason,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
