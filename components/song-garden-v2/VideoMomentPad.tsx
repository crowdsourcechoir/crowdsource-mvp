"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import TypewriterText from "@/components/TypewriterText";
import { runPadCountdown } from "@/lib/songgarden/pad-countdown";

type PadPhase = "idle" | "countdown" | "recording" | "review" | "uploading" | "done" | "error";

const DEFAULT_RECORD_MS = 20_000;

type VideoMomentPadProps = {
  promptText: string;
  /** Circle label — e.g. "RECORD". */
  buttonLabel?: string;
  accentColor: string;
  recordMs?: number;
  disabled?: boolean;
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
    if (phase === "countdown" || phase === "recording") {
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
    try {
      const stream = await navigator.mediaDevices
        .getUserMedia({
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
        })
        .catch(() =>
          navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          })
        );

      if (cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error("Microphone access is needed to record video with sound.");
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
    if (disabled) return;
    if (phase !== "idle" && phase !== "error") return;
    void runCapture();
  }, [disabled, phase, runCapture]);

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

  const ringPct =
    phase === "recording" ? progress : phase === "countdown" && countdown ? 1 - countdown / 3 : 0;
  const showLiveVideo = phase === "countdown" || phase === "recording";

  return (
    <div className="space-y-6 text-center">
      <p className="mx-auto max-w-xs font-mono text-[1.0625rem] leading-snug text-gray-100 sm:text-lg">
        <TypewriterText key={promptText} text={promptText} speed={9} className="inline" />
      </p>

      <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
        <svg className="pointer-events-none absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={phase === "recording" ? "#f87171" : accentColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 45}
            animate={{ strokeDashoffset: 2 * Math.PI * 45 * (1 - ringPct) }}
            transition={{ duration: 0.15 }}
          />
        </svg>

        {showLiveVideo && (
          <video
            ref={liveVideoRef}
            autoPlay
            playsInline
            muted
            className="pointer-events-none absolute h-28 w-28 rounded-full object-cover"
            style={{ transform: "scaleX(-1)" }}
            aria-hidden
          />
        )}

        {phase === "review" && previewUrl && (
          <video
            ref={reviewVideoRef}
            src={previewUrl}
            playsInline
            className="pointer-events-none absolute h-28 w-28 rounded-full object-cover"
            aria-hidden
          />
        )}

        <motion.button
          type="button"
          onClick={phase === "recording" ? handleStopEarly : handleTap}
          disabled={
            disabled ||
            phase === "countdown" ||
            phase === "uploading" ||
            phase === "review" ||
            phase === "done"
          }
          whileTap={{ scale: 0.94 }}
          animate={phase === "done" ? { scale: [1, 1.12, 1] } : {}}
          transition={{ duration: 0.4 }}
          className="relative z-10 flex h-28 w-28 [touch-action:manipulation] select-none flex-col items-center justify-center rounded-full font-mono text-xs font-semibold uppercase tracking-wide transition [-webkit-tap-highlight-color:transparent] [-webkit-user-select:none] disabled:cursor-default"
          style={{
            background:
              phase === "recording" || showLiveVideo
                ? "rgba(26,21,48,0.45)"
                : phase === "done"
                  ? accentColor
                  : phase === "review"
                    ? "rgba(26,21,48,0.55)"
                    : `${accentColor}1f`,
            color:
              phase === "recording"
                ? "#fecaca"
                : phase === "done"
                  ? "#1a1530"
                  : accentColor,
            border: `2px solid ${phase === "recording" ? "#f87171" : accentColor}`,
            boxShadow:
              phase === "recording" || phase === "done" || phase === "review"
                ? undefined
                : `0 0 0 10px ${accentColor}14, 0 0 0 20px ${accentColor}0a`,
          }}
        >
          {phase === "idle" && <span>{label}</span>}
          {phase === "error" && <span>Try again</span>}
          {phase === "countdown" && <span className="text-3xl tabular-nums drop-shadow">{countdown}</span>}
          {phase === "recording" && (
            <>
              <span className="text-2xl tabular-nums drop-shadow">{secondsLeft}s</span>
              <span className="mt-1 text-[10px] drop-shadow">tap to stop</span>
            </>
          )}
          {phase === "uploading" && <span>Sending…</span>}
          {phase === "review" && <span className="drop-shadow">Got it</span>}
          {phase === "done" && <span className="text-2xl">✓</span>}
        </motion.button>
      </div>

      {phase === "review" && pendingClip && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto grid max-w-xs grid-cols-2 gap-2"
        >
          <button
            type="button"
            disabled={previewPlaying || disabled}
            onClick={() => void handlePreview()}
            className="min-h-[44px] select-none rounded-xl border px-3 py-2 font-mono text-xs [touch-action:manipulation] disabled:opacity-50"
            style={{ borderColor: accentColor, color: accentColor }}
          >
            {previewPlaying ? "▶ …" : "▶ Watch"}
          </button>
          <button
            type="button"
            disabled={previewPlaying || disabled}
            onClick={handleRetry}
            className="min-h-[44px] select-none rounded-xl border px-3 py-2 font-mono text-xs [touch-action:manipulation] disabled:opacity-50"
            style={{ borderColor: accentColor, color: accentColor }}
          >
            ↻ Again
          </button>
          <button
            type="button"
            disabled={previewPlaying || disabled}
            onClick={() => void handleKeep()}
            className="col-span-2 min-h-[44px] select-none rounded-xl px-3 py-2 font-mono text-xs font-semibold [touch-action:manipulation] disabled:opacity-50"
            style={{ background: accentColor, color: "#1a1530" }}
          >
            ✓ Continue
          </button>
        </motion.div>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
