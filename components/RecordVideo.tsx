"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const COUNTDOWN_SECONDS = 5;
const MAX_SECONDS = 20;

type RecordVideoProps = {
  onRecordingReady?: (blob: Blob) => void;
  onClear?: () => void;
  className?: string;
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
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "video/webm";
}

export default function RecordVideo({ onRecordingReady, onClear, className = "" }: RecordVideoProps) {
  const [status, setStatus] = useState<"idle" | "preview" | "countdown" | "recording" | "recorded">("idle");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedMimeRef = useRef("video/webm");

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finalizeRecording = useCallback(() => {
    stopTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }
    releaseStream();
  }, [releaseStream, stopTimer]);

  useEffect(
    () => () => {
      stopTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      releaseStream();
    },
    [releaseStream, stopTimer]
  );

  const showPreview = status === "preview" || status === "countdown" || status === "recording";
  useEffect(() => {
    if (!showPreview || !streamRef.current || !videoPreviewRef.current) return;
    const video = videoPreviewRef.current;
    video.srcObject = streamRef.current;
    video.muted = true;
    video.play().catch(() => {});
  }, [showPreview, status]);

  const startActualRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

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

    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const b = new Blob(chunksRef.current, { type: recordedMimeRef.current });
      mediaRecorderRef.current = null;
      releaseStream();
      setBlob(b);
      setStatus("recorded");
      onRecordingReady?.(b);
    };

    recorder.start(1000);
    setStatus("recording");
    setSecondsLeft(MAX_SECONDS);

    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          finalizeRecording();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [finalizeRecording, onRecordingReady, releaseStream]);

  useEffect(() => {
    if (status !== "countdown") return;
    if (countdown <= 0) {
      startActualRecording();
      return;
    }
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [status, countdown, startActualRecording]);

  const requestPreview = async () => {
    setError(null);
    try {
      const videoConstraints: MediaTrackConstraints = {
        facingMode: "user",
        width: { ideal: 640, max: 960 },
        height: { ideal: 360, max: 540 },
        frameRate: { ideal: 20, max: 24 },
      };
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      const stream = await navigator.mediaDevices
        .getUserMedia({
          video: videoConstraints,
          audio: audioConstraints,
        })
        .catch(() =>
          navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          })
        );

      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        setError("Microphone access is needed to record video with sound.");
        return;
      }

      streamRef.current = stream;
      setStatus("preview");
    } catch {
      setError("Camera and microphone access are needed to record video.");
    }
  };

  const beginCountdown = () => {
    setCountdown(COUNTDOWN_SECONDS);
    setStatus("countdown");
  };

  const cancelPreviewOrCountdown = useCallback(() => {
    stopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    releaseStream();
    setStatus("idle");
    setCountdown(COUNTDOWN_SECONDS);
  }, [releaseStream, stopTimer]);

  const handleStop = () => {
    finalizeRecording();
  };

  const VideoIcon = (
    <svg className="h-8 w-8 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );

  return (
    <div className={className}>
      {error && <p className="mb-2 text-center text-sm text-red-400">{error}</p>}
      {status === "idle" && (
        <button
          type="button"
          onClick={requestPreview}
          className="crowdsource-btn-outline gap-3 sm:min-h-[64px]"
        >
          {VideoIcon}
          <span>Record video</span>
          <span className="text-sm text-current/80">(up to {MAX_SECONDS}s)</span>
        </button>
      )}
      {status === "preview" && (
        <div className="space-y-3">
          <video
            ref={videoPreviewRef}
            autoPlay
            playsInline
            muted
            className="max-h-64 w-full rounded-2xl border border-fuchsia-300/25 bg-black object-contain ring-1 ring-white/10"
            style={{ transform: "scaleX(-1)" }}
          />
          <p className="text-center text-sm text-gray-300/90">Get your selfie ready, then start recording.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={beginCountdown}
              className="min-h-[48px] rounded-xl border border-white/25 bg-white/15 px-6 py-3 text-base font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)] ring-1 ring-white/15 backdrop-blur-xl transition hover:bg-white/25 active:bg-white/20"
            >
              Start recording
            </button>
            <button
              type="button"
              onClick={cancelPreviewOrCountdown}
              className="text-sm font-medium text-gray-400 underline hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {status === "countdown" && (
        <div className="space-y-3">
          <div className="relative">
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className="max-h-64 w-full rounded-2xl border border-fuchsia-300/25 bg-black object-contain ring-1 ring-white/10"
              style={{ transform: "scaleX(-1)" }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-[#1a0f2d]/65 backdrop-blur-md ring-1 ring-inset ring-white/10">
              <p className="text-sm text-white/90">Recording in</p>
              <p className="text-5xl font-bold tabular-nums text-white">{countdown}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={cancelPreviewOrCountdown}
            className="w-full text-center text-sm font-medium text-gray-400 underline hover:text-gray-300"
          >
            Cancel
          </button>
        </div>
      )}
      {status === "recording" && (
        <div className="space-y-3">
          <video
            ref={videoPreviewRef}
            autoPlay
            playsInline
            muted
            className="max-h-64 w-full rounded-2xl border border-fuchsia-300/25 bg-black object-contain ring-1 ring-white/10"
            style={{ transform: "scaleX(-1)" }}
          />
          <div className="crowdsource-field-panel flex flex-wrap items-center justify-center gap-3 p-4">
            <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm text-white/85">Recording… {secondsLeft}s left</span>
            <button
              type="button"
              onClick={handleStop}
              className="min-h-[44px] rounded-xl bg-red-600 px-4 py-2 font-mono text-base font-medium tracking-wide text-white shadow-sm transition hover:bg-red-500 active:bg-red-700"
            >
              Stop
            </button>
          </div>
        </div>
      )}
      {status === "recorded" && blob && (
        <div className="flex flex-col items-center gap-2">
          <video
            src={URL.createObjectURL(blob)}
            controls
            playsInline
            className="max-h-64 w-full rounded-2xl border border-fuchsia-300/25 bg-black object-contain ring-1 ring-white/10"
          />
          <span className="text-sm text-gray-400">Recorded — use controls to play with sound</span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBlob(null);
                setStatus("idle");
                onClear?.();
              }}
              className="rounded-xl border border-fuchsia-300/35 bg-[#1a0f2d]/45 px-4 py-2 font-mono text-base font-medium tracking-wide text-white shadow-[0_8px_28px_rgba(0,0,0,0.3)] ring-1 ring-white/10 backdrop-blur-xl transition hover:bg-[#2d1f42]/55"
            >
              Re-record
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const RECORD_VIDEO_MAX_SECONDS = MAX_SECONDS;
