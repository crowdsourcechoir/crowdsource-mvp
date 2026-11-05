/**
 * Live Prompt Game — types and API client. Isolated from Events.
 */

import type { PromptBlock } from "@/data/signalPromptBlock";
import { putToSignedUpload } from "@/lib/songgarden/direct-upload-client";

export type PromptGameSessionState = "WAITING" | "RESPONDING" | "VOTING";
export type ResponseType = "one_word" | "short_phrase" | "sentence";
export type LiveDisplayMode = "auto" | "approve_first";
export type LiveMediaType = "photo" | "sound" | "video";

export type PromptGameSession = {
  id: string;
  slug: string;
  name: string;
  state: PromptGameSessionState;
  current_round_id: string | null;
  linked_event_id: string | null;
  /** Stage policy for media moments. Missing on old rows → treat as auto. */
  display_mode?: LiveDisplayMode;
  created_at: string;
  ended_at: string | null;
};

export type PromptGameRound = {
  id: string;
  session_id: string;
  prompt_text: string;
  response_type: ResponseType;
  character_limit: number;
  timer_seconds: number | null;
  created_at: string;
  closed_at: string | null;
  /** Structured block (Signal / Live media). From `prompt_game_rounds.prompt_block`. */
  prompt_block?: PromptBlock | null;
};

export type PromptGameSubmission = {
  id: string;
  session_id: string;
  round_id: string;
  device_id: string;
  raw_text: string;
  created_at: string;
  hidden: boolean;
  locked: boolean;
  media_type?: LiveMediaType | null;
  media_url?: string | null;
  media_path?: string | null;
  media_mime?: string | null;
  media_duration_ms?: number | null;
  approved?: boolean;
  garden_clip_id?: string | null;
};

export type PhraseCard = {
  id: string;
  raw_text: string;
  vote_count: number;
  hidden: boolean;
  locked: boolean;
};

function slug(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Request failed");
  }
  return res.json();
}

export async function createSession(options?: {
  /**
   * Display name used as the session mode label in the admin UI (e.g. "Game", "Fishbowl", "Signal").
   * Stored in `prompt_game_sessions.name`.
   */
  name?: string;
  /** Optional FK to `events.id`. Stored in `prompt_game_sessions.linked_event_id`. */
  linkedEventId?: string | null;
}): Promise<PromptGameSession> {
  return api<PromptGameSession>("/api/live-prompt-game/sessions", {
    method: "POST",
    body: JSON.stringify({
      name: options?.name,
      linked_event_id: options?.linkedEventId ?? null,
    }),
  });
}

export async function listSessions(): Promise<PromptGameSession[]> {
  const list = await api<PromptGameSession[]>("/api/live-prompt-game/sessions");
  return Array.isArray(list) ? list : [];
}

export async function getSession(id: string): Promise<PromptGameSession | null> {
  try {
    return await api<PromptGameSession>(`/api/live-prompt-game/sessions/${id}`);
  } catch {
    return null;
  }
}

export async function updateSessionState(
  id: string,
  state: PromptGameSessionState,
  current_round_id?: string | null
): Promise<PromptGameSession> {
  return api<PromptGameSession>(`/api/live-prompt-game/sessions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ state, current_round_id }),
  });
}

export async function updateSessionDisplayMode(
  id: string,
  display_mode: LiveDisplayMode
): Promise<PromptGameSession> {
  return api<PromptGameSession>(`/api/live-prompt-game/sessions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ display_mode }),
  });
}

export async function endSession(id: string): Promise<PromptGameSession> {
  return api<PromptGameSession>(`/api/live-prompt-game/sessions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ ended_at: new Date().toISOString() }),
  });
}

export async function getSessionBySlug(slug: string): Promise<PromptGameSession | null> {
  try {
    return await api<PromptGameSession>(`/api/live-prompt-game/sessions?slug=${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export async function createRound(
  sessionId: string,
  data: {
    prompt_text: string;
    response_type?: ResponseType;
    character_limit?: number;
    timer_seconds?: number | null;
    prompt_block?: PromptBlock;
  }
): Promise<PromptGameRound> {
  return api<PromptGameRound>(`/api/live-prompt-game/sessions/${sessionId}/rounds`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listRounds(sessionId: string): Promise<PromptGameRound[]> {
  const list = await api<PromptGameRound[]>(`/api/live-prompt-game/sessions/${sessionId}/rounds`);
  return Array.isArray(list) ? list : [];
}

export async function closeRound(sessionId: string, roundId: string): Promise<void> {
  await api(`/api/live-prompt-game/sessions/${sessionId}/rounds/${roundId}`, {
    method: "PATCH",
    body: JSON.stringify({ closed_at: new Date().toISOString() }),
  });
}

export async function submitResponse(
  sessionId: string,
  roundId: string,
  deviceId: string,
  raw_text: string
): Promise<PromptGameSubmission> {
  return api<PromptGameSubmission>(`/api/live-prompt-game/sessions/${sessionId}/submissions`, {
    method: "POST",
    body: JSON.stringify({ round_id: roundId, device_id: deviceId, raw_text }),
  });
}

export async function listSubmissions(sessionId: string, roundId?: string): Promise<PromptGameSubmission[]> {
  const q = roundId ? `?round_id=${roundId}` : "";
  const list = await api<PromptGameSubmission[]>(
    `/api/live-prompt-game/sessions/${sessionId}/submissions${q}`
  );
  return Array.isArray(list) ? list : [];
}

export async function castVote(
  sessionId: string,
  roundId: string,
  submissionId: string,
  deviceId: string
): Promise<void> {
  await api(`/api/live-prompt-game/sessions/${sessionId}/votes`, {
    method: "POST",
    body: JSON.stringify({ round_id: roundId, submission_id: submissionId, device_id: deviceId }),
  });
}

export async function getPhraseCards(sessionId: string, roundId: string): Promise<PhraseCard[]> {
  const list = await api<PhraseCard[]>(
    `/api/live-prompt-game/sessions/${sessionId}/phrase-cards?round_id=${roundId}`
  );
  return Array.isArray(list) ? list : [];
}

export async function getMyVotes(sessionId: string, roundId: string, deviceId: string): Promise<string[]> {
  const ids = await api<string[]>(
    `/api/live-prompt-game/sessions/${sessionId}/votes?round_id=${roundId}&device_id=${encodeURIComponent(deviceId)}`
  );
  return Array.isArray(ids) ? ids : [];
}

export async function setSubmissionHidden(sessionId: string, submissionId: string, hidden: boolean): Promise<void> {
  await api(`/api/live-prompt-game/sessions/${sessionId}/submissions/${submissionId}`, {
    method: "PATCH",
    body: JSON.stringify({ hidden }),
  });
}

export async function setSubmissionLocked(sessionId: string, submissionId: string, locked: boolean): Promise<void> {
  await api(`/api/live-prompt-game/sessions/${sessionId}/submissions/${submissionId}`, {
    method: "PATCH",
    body: JSON.stringify({ locked }),
  });
}

export async function setSubmissionApproved(
  sessionId: string,
  submissionId: string,
  approved: boolean
): Promise<void> {
  await api(`/api/live-prompt-game/sessions/${sessionId}/submissions/${submissionId}`, {
    method: "PATCH",
    body: JSON.stringify({ approved }),
  });
}

export async function submitLiveMedia(args: {
  sessionId: string;
  roundId: string;
  deviceId: string;
  mediaType: LiveMediaType;
  blob: Blob;
  mimeType: string;
  ext: string;
  durationMs?: number | null;
  consentAccepted: boolean;
}): Promise<PromptGameSubmission> {
  const prepareRes = await fetch(`/api/live-prompt-game/sessions/${args.sessionId}/media/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      round_id: args.roundId,
      device_id: args.deviceId,
      media_type: args.mediaType,
      byte_size: args.blob.size,
      content_type: args.mimeType,
      ext: args.ext,
    }),
  });
  if (!prepareRes.ok) {
    const err = await prepareRes.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Could not prepare upload");
  }
  const prepared = (await prepareRes.json()) as {
    upload: { signedUrl: string; path: string; publicUrl: string };
    contentType: string;
  };
  await putToSignedUpload(prepared.upload.signedUrl, args.blob, args.mimeType || prepared.contentType);

  return api<PromptGameSubmission>(`/api/live-prompt-game/sessions/${args.sessionId}/media/confirm`, {
    method: "POST",
    body: JSON.stringify({
      round_id: args.roundId,
      device_id: args.deviceId,
      media_type: args.mediaType,
      media_path: prepared.upload.path,
      media_mime: args.mimeType,
      media_duration_ms: args.durationMs ?? null,
      consent_accepted: args.consentAccepted,
    }),
  });
}

export function sessionDisplayMode(session: PromptGameSession | null | undefined): LiveDisplayMode {
  return session?.display_mode === "approve_first" ? "approve_first" : "auto";
}

export function exportRawCsvUrl(sessionId: string): string {
  return `/api/live-prompt-game/sessions/${sessionId}/export?format=csv`;
}

export async function generateSongPack(sessionId: string): Promise<unknown> {
  return api(`/api/live-prompt-game/sessions/${sessionId}/ai-process`, {
    method: "POST",
  });
}

export async function getSongPack(sessionId: string): Promise<unknown | null> {
  try {
    return await api(`/api/live-prompt-game/sessions/${sessionId}/song-pack`);
  } catch {
    return null;
  }
}

export function joinUrl(slug: string, baseUrl?: string): string {
  const base = (typeof window !== "undefined" ? window.location.origin : baseUrl) || "";
  return `${base.replace(/\/$/, "")}/live/${slug}`;
}

/** URL for the full-screen QR display page (host opens this on the projector/screen). */
export function displayUrl(slug: string, baseUrl?: string): string {
  const base = (typeof window !== "undefined" ? window.location.origin : baseUrl) || "";
  return `${base.replace(/\/$/, "")}/live/${slug}/display`;
}
