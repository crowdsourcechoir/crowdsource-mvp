"use client";

import type { SongSeedTranscriptIssue } from "@/types/song-seed";

export type { SongSeedTranscriptIssue };

/** Theme from config (prompt template + settings). */
export type AgentTheme = {
  id: string;
  key: string;
  name: string;
  tone: string;
  questionGoals: string[];
  maxQuestions: number;
  doDontRules: string[];
  systemPromptTemplate: string;
  createdAt?: string;
};

/** Structured agent brief (event-specific context). */
export type AgentBrief = {
  eventName?: string;
  eventType?: string;
  whoWhat?: string;
  emotionalArc?: string;
  askAbout?: string[];
  askAboutItems?: Array<{
    prompt: string;
    allowAudio?: boolean;
    allowVideo?: boolean;
    allowMedia?: boolean;
    requireEmailCaptcha?: boolean;
  }>;
  avoid?: string[];
  exampleAnswers?: string[];
};

export type AgentBriefInput = Partial<AgentBrief>;

/** Participant (created when starting an interview). */
export type AgentParticipant = {
  id: string;
  eventId: string;
  displayName: string | null;
  email: string | null;
  sessionToken: string;
  createdAt: string;
};

/** Conversation (one per participant). */
export type AgentConversation = {
  id: string;
  eventId: string;
  participantId: string;
  createdAt: string;
  updatedAt: string;
};

/** Single turn in a conversation. */
export type AgentConversationTurn = {
  id: string;
  conversationId: string;
  turnIndex: number;
  role: "agent" | "user";
  content: string;
  audioUrl: string | null;
  videoUrl: string | null;
  /** Filled asynchronously after submit (Whisper); null until ready. */
  audioTranscript?: string | null;
  videoTranscript?: string | null;
  createdAt: string;
};

/** Song Seed (generated from transcripts). */
export type SongSeed = {
  id: string;
  eventId: string;
  topThemes: string[];
  notableLines: string[];
  singableHooks: string[];
  shoutouts: string[];
  emotionalToneSummary: string;
  sourceMapping: SongSeedSourceMappingItem[];
  sunoPrompts: string[];
  createdAt: string;
};

export type SongSeedSourceMappingItem = {
  participantId?: string;
  turnId?: string;
  lineIndex?: number;
  field: string;
};

/** LLM next-message response contract. */
export type AgentNextMessageResponse = {
  agentMessage: string;
  suggestedAnswerTypes: ("text" | "voice" | "video" | "email" | "captcha" | "short")[];
  extractedTags?: string[];
  stopReason: "continue" | "finished";
};

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (res.status === 404) throw new Error("NOT_FOUND");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Request failed");
  }
  return res.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Request failed");
  }
  return res.json();
}

export async function getAgentThemes(): Promise<AgentTheme[]> {
  const list = await apiGet<AgentTheme[]>("/api/agent/themes");
  return Array.isArray(list) ? list : [];
}

export async function startAgentInterview(
  eventId: string,
  options: { sessionToken: string; displayName?: string; email?: string }
): Promise<{ participant: AgentParticipant; conversation: AgentConversation }> {
  return apiPost("/api/agent/participants", {
    eventId,
    displayName: options.displayName ?? null,
    email: options.email ?? null,
    sessionToken: options.sessionToken,
  });
}

export async function getConversation(conversationId: string): Promise<{
  conversation: AgentConversation;
  turns: AgentConversationTurn[];
}> {
  return apiGet(`/api/agent/conversations/${conversationId}`);
}

export async function sendMessage(
  conversationId: string,
  content: string,
  options?: { audioDataUrl?: string | null; videoDataUrl?: string | null; captchaToken?: string | null }
): Promise<{
  turn: AgentConversationTurn | null;
  nextMessage: AgentNextMessageResponse;
  agentTurn?: AgentConversationTurn;
}> {
  return apiPost(`/api/agent/conversations/${conversationId}/send`, {
    content,
    audioDataUrl: options?.audioDataUrl ?? null,
    videoDataUrl: options?.videoDataUrl ?? null,
    captchaToken: options?.captchaToken ?? null,
  });
}

/** Thrown when generate fails; `issues` is set when voice/video could not be transcribed (HTTP 422). */
export type GenerateSongSeedError = Error & {
  issues?: SongSeedTranscriptIssue[];
  status?: number;
};

export async function generateSongSeed(eventId: string): Promise<SongSeed> {
  const res = await fetch("/api/agent/song-seed/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    issues?: SongSeedTranscriptIssue[];
  };
  if (!res.ok) {
    const err = new Error(body.error || "Request failed") as GenerateSongSeedError;
    err.issues = body.issues;
    err.status = res.status;
    throw err;
  }
  return body as SongSeed;
}

export async function getSongSeedForEvent(eventId: string): Promise<SongSeed | null> {
  try {
    return await apiGet<SongSeed>(`/api/agent/song-seed?eventId=${encodeURIComponent(eventId)}`);
  } catch (e) {
    if ((e as Error).message === "NOT_FOUND") return null;
    throw e;
  }
}
