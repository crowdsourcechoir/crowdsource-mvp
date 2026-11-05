"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { submitLiveMedia } from "@/data/livePromptGame";
import { prepareWavFromBlob } from "@/lib/songgarden/prepare-audio";
import {
  playAudioBlob,
  playRecordStartCue,
  prefetchMicStream,
  startQuickRecord,
} from "@/lib/songgarden/quick-record";
import { runPadCountdown } from "@/lib/songgarden/pad-countdown";

const SNAP_MS = 1200;

type Phase = "idle" | "countdown" | "recording" | "review" | "uploading" | "done" | "error";

export default function LiveSnapPad({
  sessionId,
  roundId,
  deviceId,
  promptText,
  hint,
  consentAccepted,
  onSubmitted,
}: {
  sessionId: string;
  roundId: string;
  deviceId: string;
  promptText: string;
  hint?: string | null;
  consentAccepted: boolean;
  onSubmitted: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Blob | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      stopRef.current?.();
    };
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setPending(null);
    setPhase("countdown");
    try {
      const stream = await prefetchMicStream();
      await runPadCountdown((n) => setCountdown(n), 3);
      setCountdown(null);
      setPhase("recording");
      playRecordStartCue();
      const handle = startQuickRecord(
        SNAP_MS,
        (p) => setLevel(p.level),
        { stream, onRecordingStarted: () => undefined }
      );
      stopRef.current = handle.stop;
      const blob = await handle.promise;
      stopRef.current = null;
      const wav = await prepareWavFromBlob(blob);
      setPending(wav.blob);
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record.");
      setPhase("error");
    }
  }, []);

  const preview = useCallback(async () => {
    if (!pending) return;
    await playAudioBlob(pending);
  }, [pending]);

  const confirm = useCallback(async () => {
    if (!pending || !consentAccepted) return;
    setPhase("uploading");
    setError(null);
    try {
      await submitLiveMedia({
        sessionId,
        roundId,
        deviceId,
        mediaType: "sound",
        blob: pending,
        mimeType: "audio/wav",
        ext: "wav",
        durationMs: SNAP_MS,
        consentAccepted,
      });
      setPhase("done");
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setPhase("error");
    }
  }, [consentAccepted, deviceId, onSubmitted, pending, roundId, sessionId]);

  return (
    <div className="w-full max-w-md mx-auto">
      <p className="text-center text-lg font-medium text-white">{promptText}</p>
      {hint ? <p className="mt-1 text-center text-sm text-gray-400">{hint}</p> : null}

      <div className="mt-6 flex flex-col items-center gap-3">
        <div
          className="h-28 w-28 rounded-full border-2 border-[var(--csc-accent,#CFFF81)] flex items-center justify-center"
          style={{ boxShadow: `0 0 ${8 + level * 40}px rgba(207,255,129,0.35)` }}
        >
          <span className="text-sm font-semibold tracking-wide text-[var(--csc-accent,#CFFF81)]">
            {phase === "countdown" && countdown != null
              ? countdown
              : phase === "recording"
                ? "SNAP"
                : phase === "done"
                  ? "✓"
                  : "MIC"}
          </span>
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {phase === "idle" || phase === "error" ? (
          <button
            type="button"
            onClick={() => void start()}
            className="w-full rounded-xl bg-[var(--csc-accent,#CFFF81)] px-4 py-3 text-sm font-semibold text-gray-900"
          >
            {phase === "error" ? "Try again" : "Record snap"}
          </button>
        ) : null}
        {phase === "countdown" || phase === "recording" ? (
          <p className="text-sm text-gray-400">
            {phase === "countdown" ? "Get ready…" : "Recording…"}
          </p>
        ) : null}
        {phase === "review" ? (
          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={() => void preview()}
              className="rounded-xl border border-gray-700 px-4 py-3 text-sm text-gray-200"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              className="rounded-xl bg-[var(--csc-accent,#CFFF81)] px-4 py-3 text-sm font-semibold text-gray-900"
            >
              Send to the room
            </button>
            <button
              type="button"
              onClick={() => void start()}
              className="rounded-xl border border-gray-800 px-4 py-2 text-sm text-gray-400"
            >
              Re-record
            </button>
          </div>
        ) : null}
        {phase === "uploading" ? <p className="text-sm text-gray-400">Sending…</p> : null}
        {phase === "done" ? (
          <p className="text-sm text-[var(--csc-accent,#CFFF81)]">Snap received.</p>
        ) : null}
      </div>
    </div>
  );
}
