"use client";

import { useState, useRef, useCallback } from "react";

const MAX_SECONDS = 20;

type RecordAudioProps = {
  onRecordingReady?: (blob: Blob) => void;
  onClear?: () => void;
  className?: string;
};

export default function RecordAudio({ onRecordingReady, onClear, className = "" }: RecordAudioProps) {
  const [status, setStatus] = useState<"idle" | "recording" | "recorded">("idle");
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  }, []);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const options: MediaRecorderOptions = { audioBitsPerSecond: 256000 };
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options.mimeType = "audio/webm;codecs=opus";
      }
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const b = new Blob(chunksRef.current, { type: "audio/webm" });
        setBlob(b);
        setStatus("recorded");
        onRecordingReady?.(b);
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
      setError("Microphone access is needed to record.");
    }
  };

  const handleStop = () => {
    stopRecording();
  };

  const MicIcon = (
    <svg className="h-8 w-8 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
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
          {MicIcon}
          <span>Record audio</span>
          <span className="text-sm text-gray-400">(up to {MAX_SECONDS}s)</span>
        </button>
      )}
      {status === "recording" && (
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
      )}
      {status === "recorded" && blob && (
        <div className="flex flex-col items-center gap-2">
          <audio src={URL.createObjectURL(blob)} controls className="h-10 w-full max-w-full" />
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

export const RECORD_AUDIO_MAX_SECONDS = MAX_SECONDS;
