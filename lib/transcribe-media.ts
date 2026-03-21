import OpenAI, { toFile } from "openai";
import type { SongSeedTranscriptIssue } from "@/types/song-seed";

/** Whisper file size limit (25 MB). */
const MAX_BYTES = 25 * 1024 * 1024;

const FETCH_TIMEOUT_MS = 120_000;

function decodeDataUrl(dataUrl: string): { buffer: Buffer; mime: string } | null {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  return { buffer, mime };
}

function extFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("m4a") || m.includes("mp4a")) return "m4a";
  if (m.includes("flac")) return "flac";
  return "webm";
}

function extFromUrlPath(url: string): string | null {
  try {
    const path = url.split("?")[0] ?? "";
    const seg = path.split("/").pop() ?? "";
    const dot = seg.lastIndexOf(".");
    if (dot === -1) return null;
    const ext = seg.slice(dot + 1).toLowerCase();
    if (/^[a-z0-9]{2,5}$/.test(ext)) return ext;
  } catch {
    /* ignore */
  }
  return null;
}

function pickFilename(url: string, contentType: string | null, kind: "audio" | "video"): string {
  const fromMime = contentType ? extFromMime(contentType) : null;
  const fromPath = extFromUrlPath(url);
  const ext = fromMime || fromPath || (kind === "video" ? "mp4" : "webm");
  return `media.${ext}`;
}

/**
 * Fetch remote media or decode a data URL, then transcribe with Whisper.
 * Returns null on failure (logs a warning).
 */
export async function transcribeMediaUrl(
  openai: OpenAI,
  url: string,
  kind: "audio" | "video"
): Promise<string | null> {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  try {
    let buffer: Buffer;
    let filename: string;

    if (trimmed.startsWith("data:")) {
      const parsed = decodeDataUrl(trimmed);
      if (!parsed) {
        console.warn("transcribeMediaUrl: invalid data URL");
        return null;
      }
      if (parsed.buffer.length > MAX_BYTES) {
        console.warn("transcribeMediaUrl: data URL too large");
        return null;
      }
      filename = `media.${extFromMime(parsed.mime)}`;
      buffer = parsed.buffer;
    } else {
      const res = await fetch(trimmed, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) {
        console.warn(`transcribeMediaUrl: fetch ${res.status} for ${trimmed.slice(0, 96)}`);
        return null;
      }
      const len = res.headers.get("content-length");
      if (len && Number(len) > MAX_BYTES) {
        console.warn("transcribeMediaUrl: Content-Length exceeds Whisper limit");
        return null;
      }
      const ab = await res.arrayBuffer();
      buffer = Buffer.from(ab);
      if (buffer.length > MAX_BYTES) {
        console.warn("transcribeMediaUrl: response too large for Whisper");
        return null;
      }
      filename = pickFilename(trimmed, res.headers.get("content-type"), kind);
    }

    const file = await toFile(buffer, filename);
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    const text = typeof transcription.text === "string" ? transcription.text.trim() : "";
    return text || null;
  } catch (e) {
    console.warn("transcribeMediaUrl failed:", e);
    return null;
  }
}

export type SongSeedTurnInput = {
  role: string;
  content: string;
  audioUrl?: string | null;
  videoUrl?: string | null;
  /** When a non-null string, Whisper is skipped for that track (from post-submit job). */
  audioTranscript?: string | null;
  videoTranscript?: string | null;
};

function combineParticipantLine(
  text: string,
  audioTranscript: string | null,
  videoTranscript: string | null
): string {
  const parts: string[] = [];
  if (text.trim()) parts.push(text.trim());
  if (audioTranscript?.trim()) parts.push(`[Voice: ${audioTranscript.trim()}]`);
  if (videoTranscript?.trim()) parts.push(`[Video: ${videoTranscript.trim()}]`);
  if (parts.length === 0) return "(no text or transcribable speech)";
  return parts.join(" ");
}

/**
 * Use stored transcripts when present (strings from async post-submit job); otherwise Whisper.
 */
async function transcribeUserMedia(
  openai: OpenAI,
  audioUrl: string | null | undefined,
  videoUrl: string | null | undefined,
  cachedAudio: string | null | undefined,
  cachedVideo: string | null | undefined
): Promise<{ audio: string | null; video: string | null }> {
  let videoT: string | null = null;
  let audioT: string | null = null;

  if (typeof cachedVideo === "string") {
    videoT = cachedVideo.trim() || null;
  } else if (videoUrl?.trim()) {
    videoT = await transcribeMediaUrl(openai, videoUrl, "video");
  }

  if (typeof cachedAudio === "string") {
    audioT = cachedAudio.trim() || null;
  } else if (audioUrl?.trim()) {
    audioT = await transcribeMediaUrl(openai, audioUrl, "audio");
  }

  return { audio: audioT, video: videoT };
}

const TRANSCRIPT_BLOCKED_MESSAGE =
  "Some voice or video answers could not be transcribed. Participants can add typed text for those answers, or try generating again after checking the recordings. Until then, the song seed would miss what was only said in those clips.";

export type BuildSongSeedTranscriptResult =
  | { ok: true; text: string }
  | { ok: false; error: string; issues: SongSeedTranscriptIssue[] };

/**
 * Build full transcript text for Song Seed (typed lines + Whisper for voice/video).
 * Fails with `ok: false` if any turn has voice/video but no typed text and Whisper returns nothing
 * (so hosts are not surprised when a later step omits that content).
 */
export async function buildSongSeedTranscriptText(
  openai: OpenAI,
  sessions: Array<{
    participantLabel: string;
    conversationId: string;
    turns: SongSeedTurnInput[];
  }>
): Promise<BuildSongSeedTranscriptResult> {
  let transcriptText = "";
  const issues: SongSeedTranscriptIssue[] = [];

  for (const session of sessions) {
    transcriptText += `\n--- Participant: ${session.participantLabel} (conversation ${session.conversationId}) ---\n`;

    for (const turn of session.turns) {
      const isAgent = turn.role === "agent";
      const roleLabel = isAgent ? "Agent" : "Participant";

      if (isAgent) {
        transcriptText += `${roleLabel}: ${turn.content}\n`;
        continue;
      }

      const { audio, video } = await transcribeUserMedia(
        openai,
        turn.audioUrl,
        turn.videoUrl,
        turn.audioTranscript,
        turn.videoTranscript
      );
      const typed = (turn.content ?? "").trim();
      const hasSpeech = !!(audio?.trim() || video?.trim());
      const hasMedia = !!(turn.audioUrl?.trim() || turn.videoUrl?.trim());

      if (!typed && hasMedia && !hasSpeech) {
        if (turn.videoUrl?.trim() && !video?.trim()) {
          issues.push({
            conversationId: session.conversationId,
            participantLabel: session.participantLabel,
            kind: "video",
          });
        }
        if (turn.audioUrl?.trim() && !audio?.trim()) {
          issues.push({
            conversationId: session.conversationId,
            participantLabel: session.participantLabel,
            kind: "audio",
          });
        }
      }

      const line = combineParticipantLine(turn.content ?? "", audio, video);
      transcriptText += `${roleLabel}: ${line}\n`;
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      error: TRANSCRIPT_BLOCKED_MESSAGE,
      issues,
    };
  }

  return { ok: true, text: transcriptText };
}

export { TRANSCRIPT_BLOCKED_MESSAGE };
