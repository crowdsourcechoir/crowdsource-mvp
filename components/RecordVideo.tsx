"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const MAX_SECONDS = 20;

type RecordVideoProps = {
  onRecordingReady?: (blob: Blob) => void;
  onClear?: () => void;
  className?: string;
};

export default function RecordVideo({ onRecordingReady, onClear, className = "" }: RecordVideoProps) {
  const [status, setStatus] = useState<"idle" | "recording" | "recorded">("idle");
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopRecording(), [stopRecording]);

  // Attach stream to video once the recording UI is mounted (so the <video> element exists)
  useEffect(() => {
    if (status !== "recording" || !streamRef.current || !videoPreviewRef.current) return;
    const video = videoPreviewRef.current;
    video.srcObject = streamRef.current;
    video.muted = true;
    video.play().catch(() => {});
  }, [status]);

  const startRecording = async () => {
    setError(null);
    try {
      // Prefer front camera on phones for selfie video
      const videoConstraints: MediaTrackConstraints = {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: true,
      }).catch(() =>
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      );
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const recorder = new MediaRecorder(stream, {
        videoBitsPerSecond: 5000000,
        audioBitsPerSecond: 256000,
        mimeType,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const b = new Blob(chunksRef.current, { type: "video/webm" });
        setBlob(b);
        setStatus("recorded");
        onRecordingReady?.(b);
        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
      };

      recorder.start();
      setStatus("recording");
      setSecondsLeft(MAX_SECONDS);

      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            stopRecording();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch (err) {
      setError("Camera access is needed to record video.");
    }
  };

  const handleStop = () => {
    stopRecording();
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
          onClick={startRecording}
          className="flex min-h-[56px] w-full min-w-0 items-center justify-center gap-3 rounded-2xl border-2 border-gray-600 bg-gray-800 px-6 py-4 text-base font-medium text-white active:bg-gray-700 sm:min-h-[64px]"
        >
          {VideoIcon}
          <span>Record video</span>
          <span className="text-sm text-gray-400">(up to {MAX_SECONDS}s)</span>
        </button>
      )}
      {status === "recording" && (
        <div className="space-y-3">
          <video
            ref={videoPreviewRef}
            autoPlay
            playsInline
            muted
            className="aspect-video max-h-64 w-full rounded-2xl border-2 border-gray-700 bg-black object-contain"
            style={{ transform: "scaleX(-1)" }}
          />
          <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border-2 border-red-500/50 bg-gray-800/80 p-4">
            <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm text-gray-300">Recording… {secondsLeft}s left</span>
            <button
              type="button"
              onClick={handleStop}
              className="min-h-[44px] rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white active:bg-red-700"
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
            muted
            className="aspect-video max-h-64 w-full rounded-2xl border-2 border-gray-700 bg-black object-contain"
          />
          <span className="text-sm text-gray-400">Recorded</span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBlob(null);
                setStatus("idle");
                onClear?.();
              }}
              className="rounded-xl border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
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
