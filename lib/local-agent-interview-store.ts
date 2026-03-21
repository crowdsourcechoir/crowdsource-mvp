import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type LocalAgentParticipant = {
  id: string;
  eventId: string;
  name: string | null;
  sessionToken: string;
  createdAt: string;
};

export type LocalAgentConversation = {
  id: string;
  eventId: string;
  participantId: string;
  createdAt: string;
  updatedAt: string;
};

export type LocalAgentTurn = {
  id: string;
  conversationId: string;
  turnIndex: number;
  role: "agent" | "user";
  content: string;
  audioUrl: string | null;
  videoUrl: string | null;
  /** Filled by async Whisper job after submit (same semantics as Supabase). */
  audioTranscript: string | null;
  videoTranscript: string | null;
  createdAt: string;
};

type LocalAgentStore = {
  participants: LocalAgentParticipant[];
  conversations: LocalAgentConversation[];
  turns: LocalAgentTurn[];
};

const STORE_PATH = path.join(process.cwd(), ".data", "agent-interview-local.json");

async function loadStore(): Promise<LocalAgentStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalAgentStore>;
    return {
      participants: Array.isArray(parsed.participants) ? parsed.participants : [],
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      turns: Array.isArray(parsed.turns) ? parsed.turns : [],
    };
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return { participants: [], conversations: [], turns: [] };
    }
    throw err;
  }
}

async function saveStore(store: LocalAgentStore): Promise<void> {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), { mode: 0o600 });
}

export async function localFindParticipantBySessionToken(eventId: string, sessionToken: string) {
  const store = await loadStore();
  return store.participants.find((p) => p.eventId === eventId && p.sessionToken === sessionToken) ?? null;
}

export async function localCreateOrGetParticipantAndConversation(args: {
  eventId: string;
  name?: string | null;
  sessionToken: string;
}): Promise<{ participant: LocalAgentParticipant; conversation: LocalAgentConversation }> {
  const store = await loadStore();
  const existing = store.participants.find((p) => p.eventId === args.eventId && p.sessionToken === args.sessionToken) ?? null;

  if (existing) {
    const conv = store.conversations.find((c) => c.participantId === existing.id) ?? null;
    if (conv) return { participant: existing, conversation: conv };
  }

  const participant: LocalAgentParticipant = {
    id: randomUUID(),
    eventId: args.eventId,
    name: args.name ?? null,
    sessionToken: args.sessionToken,
    createdAt: new Date().toISOString(),
  };

  const conversation: LocalAgentConversation = {
    id: randomUUID(),
    eventId: args.eventId,
    participantId: participant.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.participants.push(participant);
  store.conversations.push(conversation);
  await saveStore(store);

  return { participant, conversation };
}

export async function localGetConversation(conversationId: string): Promise<{ conversation: LocalAgentConversation; turns: LocalAgentTurn[] } | null> {
  const store = await loadStore();
  const conversation = store.conversations.find((c) => c.id === conversationId) ?? null;
  if (!conversation) return null;
  const turns = store.turns
    .filter((t) => t.conversationId === conversationId)
    .sort((a, b) => a.turnIndex - b.turnIndex)
    .map(normalizeTurn);
  return { conversation, turns };
}

function normalizeTurn(t: LocalAgentTurn): LocalAgentTurn {
  return {
    ...t,
    audioTranscript: t.audioTranscript ?? null,
    videoTranscript: t.videoTranscript ?? null,
  };
}

export async function localInsertTurn(args: {
  conversationId: string;
  turnIndex: number;
  role: "agent" | "user";
  content: string;
  audioUrl?: string | null;
  videoUrl?: string | null;
}): Promise<LocalAgentTurn> {
  const store = await loadStore();
  const turn: LocalAgentTurn = {
    id: randomUUID(),
    conversationId: args.conversationId,
    turnIndex: args.turnIndex,
    role: args.role,
    content: args.content,
    audioUrl: args.audioUrl ?? null,
    videoUrl: args.videoUrl ?? null,
    audioTranscript: null,
    videoTranscript: null,
    createdAt: new Date().toISOString(),
  };
  store.turns.push(turn);

  // Touch conversation updatedAt.
  const conv = store.conversations.find((c) => c.id === args.conversationId);
  if (conv) conv.updatedAt = new Date().toISOString();

  await saveStore(store);
  return turn;
}

export async function localUpdateTurnTranscripts(args: {
  turnId: string;
  audioTranscript: string | null;
  videoTranscript: string | null;
}): Promise<void> {
  const store = await loadStore();
  const t = store.turns.find((x) => x.id === args.turnId);
  if (!t) return;
  t.audioTranscript = args.audioTranscript;
  t.videoTranscript = args.videoTranscript;
  await saveStore(store);
}

export async function localUpdateParticipantName(args: { participantId: string; name: string | null }): Promise<void> {
  const store = await loadStore();
  const p = store.participants.find((x) => x.id === args.participantId);
  if (!p) return;
  p.name = args.name ?? null;
  await saveStore(store);
}

export async function localGetParticipant(participantId: string): Promise<LocalAgentParticipant | null> {
  const store = await loadStore();
  return store.participants.find((p) => p.id === participantId) ?? null;
}

export async function localGetEventTranscripts(eventId: string): Promise<
  Array<{
    participantId: string;
    participantName: string;
    conversationId: string;
    turns: LocalAgentTurn[];
  }>
> {
  const store = await loadStore();
  const participantById = new Map<string, string>(
    store.participants.map((p) => [p.id, p.name ?? "Anonymous"])
  );
  const conversations = store.conversations.filter((c) => c.eventId === eventId);
  const results = conversations.map((c) => {
    const turns = store.turns
      .filter((t) => t.conversationId === c.id)
      .sort((a, b) => a.turnIndex - b.turnIndex)
      .map(normalizeTurn);
    return {
      participantId: c.participantId,
      participantName: participantById.get(c.participantId) ?? "Anonymous",
      conversationId: c.id,
      turns,
    };
  });
  // Stable ordering for reproducibility.
  results.sort((a, b) => (a.conversationId < b.conversationId ? -1 : 1));
  return results;
}

