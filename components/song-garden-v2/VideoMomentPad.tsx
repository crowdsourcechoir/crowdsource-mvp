"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import TypewriterText from "@/components/TypewriterText";
import { runPadCountdown } from "@/lib/songgarden/pad-countdown";
import CameraCaptureShell from "./CameraCaptureShell";

type PadPhase = "idle" | "opening" | "countdown" | "recording" | "review" | "uploading" | "done" | "error";

const DEFAULT_RECORD_MS = 20_000;

type VideoMomentPadProps = {
  promptText: string;
  /** Circle label — e.g. "RECORD". */
  buttonLabel?: string;
  accentColor: string;
  recordMs?: number;
  disabled?: boolean;
  hint?: string | null;
  /** When true, parent already shows the question on the same card. */
  hidePrompt?: boolean;
  /** When true, parent already shows helper text on the same card. */
  hideHint?: boolean;
  /** Called with the captured clip when the participant confirms; parent should upload then advance. */
  onSubmitted: (blob: Blob) => void | Promise<void>;
};

function pickVideoMimeType(hasAudio: boolean): string {
  const candidates = hasAudio
    ? [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=h264,opus",
        "video/mp4",
        "video/webm;codecs=vp9",
        "video/webm",
      ]
    : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];

  for (const mime of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "video/webm";
}

/**
 * Agent-interview video capture using the same circle + ring interaction as SoundMomentPad / VoiceMomentPad.
 * Never uses the old rectangular RecordVideo bar buttons.
 */
export default function VideoMomentPad({
  promptText,
  buttonLabel = "Record",
  accentColor,
  recordMs = DEFAULT_RECORD_MS,
  disabled = false,
  hint,
  hidePrompt = false,
  hideHint = false,
  onSubmitted,
}: VideoMomentPadProps) {
  const [phase, setPhase] = useState<PadPhase>("idle");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pendingClip, setPendingClip] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const reviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedMimeRef = useRef("video/webm");
  const stopTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartedAtRef = useRef(0);
  const cancelledRef = useRef(false);

  const label = buttonLabel.trim() || "Record";

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
  }, []);

  const clearStopTimer = useCallback(() => {
    if (stopTimerRef.current) {
      clearInterval(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      clearStopTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      releaseStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup once on unmount
  }, []);

  useEffect(() => {
    if (!pendingClip) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(pendingClip);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, [pendingClip]);

  const attachLivePreview = useCallback(() => {
    const video = liveVideoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.muted = true;
    void video.play().catch(() => {});
  }, []);

  useEffect(() => {
    if (phase === "opening" || phase === "countdown" || phase === "recording") {
      attachLivePreview();
    }
  }, [phase, attachLivePreview]);

  const stopRecording = useCallback(() => {
    clearStopTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, [clearStopTimer]);

  const runCapture = useCallback(async () => {
    setError(null);
    cancelledRef.current = false;
    setPhase("opening");
    try {
      // Prefer video+audio; fall back to video-only so video prompts work without a mic.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640, max: 960 },
            height: { ideal: 360, max: 540 },
            frameRate: { ideal: 20, max: 24 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640, max: 960 },
            height: { ideal: 360, max: 540 },
            frameRate: { ideal: 20, max: 24 },
          },
          audio: false,
        });
      }

      if (cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      setPhase("countdown");
      await runPadCountdown((n) => setCountdown(n));
      setCountdown(null);

      if (cancelledRef.current) {
        releaseStream();
        return;
      }

      const hasAudio = stream.getAudioTracks().length > 0;
      const mimeType = pickVideoMimeType(hasAudio);
      recordedMimeRef.current = mimeType;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 500_000,
        ...(hasAudio ? { audioBitsPerSecond: 64_000 } : {}),
      });
      mediaRecorderRef.current = recorder;

      const finished = new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunksRef.current.push(e.data);
        };
        recorder.onerror = () => reject(new Error("Could not capture that. Try again."));
        recorder.onstop = () => {
          mediaRecorderRef.current = null;
          releaseStream();
          clearStopTimer();
          const blob = new Blob(chunksRef.current, { type: recordedMimeRef.current });
          resolve(blob);
        };
      });

      recorder.start(1000);
      setPhase("recording");
      recordingStartedAtRef.current = Date.now();
      setSecondsLeft(Math.ceil(recordMs / 1000));
      setProgress(0);

      stopTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartedAtRef.current;
        const remaining = Math.max(0, recordMs - elapsed);
        setSecondsLeft(Math.max(0, Math.ceil(remaining / 1000)));
        setProgress(recordMs > 0 ? Math.min(1, elapsed / recordMs) : 0);
        if (remaining <= 0) stopRecording();
      }, 100);

      const clip = await finished;
      if (cancelledRef.current) return;
      setSecondsLeft(null);
      setProgress(0);
      setPendingClip(clip);
      setPhase("review");
    } catch (err) {
      clearStopTimer();
      releaseStream();
      mediaRecorderRef.current = null;
      setCountdown(null);
      setSecondsLeft(null);
      setProgress(0);
      setPhase("error");
      setError(err instanceof Error ? err.message : "Could not capture that. Try again.");
      window.setTimeout(() => setPhase((p) => (p === "error" ? "idle" : p)), 1800);
    }
  }, [clearStopTimer, recordMs, releaseStream, stopRecording]);

  const handleTap = useCallback(() => {
    // Allow starting capture while the parent boots the conversation.
    // `disabled` still blocks Keep/upload after recording.
    if (phase !== "idle" && phase !== "error") return;
    void runCapture();
  }, [phase, runCapture]);

  const handleStopEarly = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  const handlePreview = useCallback(async () => {
    const video = reviewVideoRef.current;
    if (!video || !previewUrl) return;
    setPreviewPlaying(true);
    try {
      video.currentTime = 0;
      await video.play();
      await new Promise<void>((resolve) => {
        const onEnded = () => {
          video.removeEventListener("ended", onEnded);
          resolve();
        };
        video.addEventListener("ended", onEnded);
      });
    } catch {
      // ignore play failures
    } finally {
      setPreviewPlaying(false);
    }
  }, [previewUrl]);

  const handleRetry = useCallback(() => {
    reviewVideoRef.current?.pause();
    setPreviewPlaying(false);
    setPendingClip(null);
    setPhase("idle");
    void runCapture();
  }, [runCapture]);

  const handleKeep = useCallback(async () => {
    if (!pendingClip || disabled) return;
    reviewVideoRef.current?.pause();
    setPreviewPlaying(false);
    setPhase("uploading");
    setError(null);
    try {
      await onSubmitted(pendingClip);
      setPendingClip(null);
      setPhase("done");
    } catch (err) {
      setPhase("review");
      setError(err instanceof Error ? err.message : "Couldn't send that. Try again.");
    }
  }, [disabled, onSubmitted, pendingClip]);

  const handleCancelCamera = useCallback(() => {
    cancelledRef.current = true;
    clearStopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;
    releaseStream();
    reviewVideoRef.current?.pause();
    setPreviewPlaying(false);
    setPendingClip(null);
    setCountdown(null);
    setSecondsLeft(null);
    setProgress(0);
    setPhase("idle");
  }, [clearStopTimer, releaseStream]);


  const inCameraUi =
    phase === "opening" ||
    phase === "countdown" ||
    phase === "recording" ||
    phase === "review" ||
    phase === "uploading";

  return (
    <div className={`text-center ${hidePrompt ? "space-y-4" : "space-y-6"}`}>
      {!hidePrompt && (
        <p className="mx-auto max-w-xs font-mono text-[1.0625rem] leading-snug text-gray-100 sm:text-lg">
          <TypewriterText key={promptText} text={promptText} speed={9} className="inline" />
        </p>
      )}
      {!hideHint && hint ? (
        <p className={`${hidePrompt ? "" : "-mt-3 "}font-mono text-xs`} style={{ color: accentColor, opacity: 0.85 }}>
          {hint}
        </p>
      ) : null}

      {!inCameraUi && (
        <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
          <svg className="pointer-events-none absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={accentColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 45}
              strokeDashoffset={2 * Math.PI * 45 * 0.85}
            />
          </svg>
          <motion.button
            type="button"
            onClick={handleTap}
            disabled={phase === "done"}
            whileTap={{ scale: 0.94 }}
            animate={phase === "done" ? { scale: [1, 1.12, 1] } : {}}
            transition={{ duration: 0.4 }}
            className="relative z-10 flex h-28 w-28 select-none flex-col items-center justify-center rounded-full font-mono text-xs font-semibold uppercase tracking-wide [touch-action:manipulation] disabled:opacity-70"
            style={{
              background: phase === "done" ? accentColor : `${accentColor}1f`,
              color: phase === "done" ? "#1a1530" : accentColor,
              border: `2px solid ${accentColor}`,
              boxShadow: phase === "done" ? undefined : `0 0 0 10px ${accentColor}14, 0 0 0 20px ${accentColor}0a`,
            }}
          >
            {phase === "done" ? "✓" : phase === "error" ? "Try again" : label}
          </motion.button>
        </div>
      )}

      {error && !inCameraUi ? <p className="text-sm text-red-300">{error}</p> : null}

      {inCameraUi ? (
        <CameraCaptureShell
          modeLabel="VIDEO"
          accentColor={accentColor}
          onClose={handleCancelCamera}
          status={
            phase === "opening"
              ? "Opening camera…"
              : phase === "countdown" && countdown != null
                ? `Starting in ${countdown}…`
                : phase === "recording" && secondsLeft != null
                  ? `${secondsLeft}s · tap stop when you're done`
                  : phase === "uploading"
                    ? "Sending…"
                    : phase === "review"
                      ? "Looks good?"
                      : null
          }
          media={
            <>
              {(phase === "opening" || phase === "countdown" || phase === "recording") && (
                <video
                  ref={liveVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
              )}
              {(phase === "review" || phase === "uploading") && previewUrl ? (
                <video
                  ref={reviewVideoRef}
                  src={previewUrl}
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
              {phase === "countdown" && countdown != null ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="font-mono text-7xl font-semibold text-white drop-shadow-lg tabular-nums">
                    {countdown}
                  </span>
                </div>
              ) : null}
              {phase === "recording" ? (
                <div className="absolute left-4 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                  <span className="font-mono text-xs tabular-nums text-white">{secondsLeft ?? 0}s</span>
                </div>
              ) : null}
              {error ? (
                <p className="absolute inset-x-4 bottom-4 rounded-xl bg-black/70 px-3 py-2 text-center font-mono text-xs text-red-200">
                  {error}
                </p>
              ) : null}
            </>
          }
          leftAction={
            phase === "review" || phase === "uploading" ? (
              <div className="flex flex-col items-start gap-1">
                <button
                  type="button"
                  disabled={previewPlaying || disabled || phase === "uploading"}
                  onClick={() => void handlePreview()}
                  className="min-h-[40px] rounded-full px-2 font-mono text-xs text-white/90 disabled:opacity-40"
                >
                  {previewPlaying ? "…" : "Watch"}
                </button>
                <button
                  type="button"
                  disabled={previewPlaying || disabled || phase === "uploading"}
                  onClick={handleRetry}
                  className="min-h-[40px] rounded-full px-2 font-mono text-xs text-white/90 disabled:opacity-40"
                >
                  Again
                </button>
              </div>
            ) : (
              <span />
            )
          }
          shutter={
            phase === "opening" || phase === "countdown" ? (
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[4px] border-white/40">
                <span className="h-4 w-4 animate-pulse rounded-full bg-red-500" />
              </div>
            ) : phase === "recording" ? (
              <motion.button
                type="button"
                aria-label="Stop recording"
                onClick={handleStopEarly}
                whileTap={{ scale: 0.94 }}
                className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[4px] border-white"
              >
                <span className="h-7 w-7 rounded-md bg-red-500" />
              </motion.button>
            ) : (
              <motion.button
                type="button"
                aria-label="Keep video"
                disabled={disabled || phase === "uploading" || previewPlaying}
                onClick={() => void handleKeep()}
                whileTap={{ scale: 0.96 }}
                className="flex h-[72px] w-[72px] items-center justify-center rounded-full font-mono text-xs font-semibold disabled:opacity-50"
                style={{ background: accentColor, color: "#1a1530" }}
              >
                {phase === "uploading" || disabled ? "…" : "Keep"}
              </motion.button>
            )
          }
        />
      ) : null}
    </div>
  );
}
