import OpenAI from "openai";
import { waitUntil } from "@vercel/functions";
import { supabaseAdmin } from "@/lib/supabase-server";
import { localUpdateTurnTranscripts } from "@/lib/local-agent-interview-store";
import { transcribeMediaUrl } from "@/lib/transcribe-media";

export type PostSubmitTranscribeArgs = {
  turnId: string;
  audioUrl: string | null;
  videoUrl: string | null;
  mode: "supabase" | "local";
};

/**
 * Whisper audio + video URLs and persist transcripts (admin/backend; does not block the client).
 */
export async function runPostSubmitTranscriptionJob(args: PostSubmitTranscribeArgs): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[post-submit transcribe] OPENAI_API_KEY missing; skipping");
    return;
  }

  let audioT: string | null = null;
  let videoT: string | null = null;

  try {
    const openai = new OpenAI({ apiKey });
    if (args.videoUrl?.trim()) {
      videoT = await transcribeMediaUrl(openai, args.videoUrl, "video");
    }
    if (args.audioUrl?.trim()) {
      audioT = await transcribeMediaUrl(openai, args.audioUrl, "audio");
    }

    if (args.mode === "supabase" && supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from("agent_conversation_turns")
        .update({
          audio_transcript: audioT,
          video_transcript: videoT,
        })
        .eq("id", args.turnId);
      if (error) console.error("[post-submit transcribe] supabase update:", error.message);
    } else if (args.mode === "local") {
      await localUpdateTurnTranscripts({
        turnId: args.turnId,
        audioTranscript: audioT,
        videoTranscript: videoT,
      });
    }
  } catch (e) {
    console.error("[post-submit transcribe] failed:", e);
  }
}

/**
 * Run after the HTTP response is ready so the participant does not wait on Whisper.
 * Uses Vercel `waitUntil` when deployed; otherwise best-effort fire-and-forget.
 */
export function schedulePostSubmitTranscription(promise: Promise<void>): void {
  try {
    waitUntil(promise);
  } catch {
    void promise.catch((err) => console.error("[post-submit transcribe] background:", err));
  }
}

export function scheduleTranscriptionIfMediaPresent(args: PostSubmitTranscribeArgs): void {
  if (!args.audioUrl?.trim() && !args.videoUrl?.trim()) return;
  schedulePostSubmitTranscription(runPostSubmitTranscriptionJob(args));
}
