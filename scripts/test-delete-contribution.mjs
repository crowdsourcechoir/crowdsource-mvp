/**
 * Delete one user contribution without wiping the rest of the interview.
 * Run: USE_LOCAL_EVENTS=true npx tsx scripts/test-delete-contribution.mjs
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

mkdirSync(path.join(process.cwd(), ".data"), { recursive: true });

process.env.USE_LOCAL_EVENTS = "true";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const store = await load("lib/local-agent-interview-store.ts");
  const { DELETE } = await load(
    "app/api/agent/conversations/[conversationId]/turns/[turnId]/route.ts"
  );

  const eventId = `local-delete-test-${Date.now()}`;
  const { conversation } = await store.localCreateOrGetParticipantAndConversation({
    eventId,
    displayName: "Delete Test",
    sessionToken: `sess-${Date.now()}`,
  });

  await store.localInsertTurn({
    conversationId: conversation.id,
    turnIndex: 0,
    role: "agent",
    content: "Share a photo.",
  });
  const keep = await store.localInsertTurn({
    conversationId: conversation.id,
    turnIndex: 1,
    role: "user",
    content: "Keep this line.",
  });
  const drop = await store.localInsertTurn({
    conversationId: conversation.id,
    turnIndex: 2,
    role: "user",
    content: "",
    videoUrl: "data:image/png;base64,xx",
  });

  const res = await DELETE(new Request("http://localhost/api"), {
    params: Promise.resolve({ conversationId: conversation.id, turnId: drop.id }),
  });
  assert.equal(res.status, 200);

  const after = await store.localGetConversation(conversation.id);
  const ids = after.turns.map((t) => t.id);
  assert.equal(ids.includes(drop.id), false);
  assert.equal(ids.includes(keep.id), true);

  const agentOnly = await DELETE(new Request("http://localhost/api"), {
    params: Promise.resolve({ conversationId: conversation.id, turnId: after.turns[0].id }),
  });
  assert.equal(agentOnly.status, 404);

  await store.localDeleteConversation(conversation.id);
  console.log("ok — delete one contribution");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
