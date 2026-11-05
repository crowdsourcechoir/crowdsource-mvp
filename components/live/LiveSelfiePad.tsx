"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { submitLiveMedia } from "@/data/livePromptGame";

type Phase = "boot" | "ready" | "preview" | "uploading" | "done" | "error";

export default function LiveSelfiePad({
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("boot");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setPhase("boot");
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera permission needed.");
      setPhase("error");
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();
    return () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per round
  }, [roundId]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) {
      setError("Camera not ready yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Could not capture frame.");
      return;
    }
    // Mirror so it matches the selfie preview people expect.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (next) => {
        if (!next) {
          setError("Could not encode selfie.");
          return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(next);
        setBlob(next);
        setPreviewUrl(url);
        setPhase("preview");
        stopCamera();
      },
      "image/jpeg",
      0.85
    );
  }, [previewUrl, stopCamera]);

  const retake = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    void startCamera();
  }, [previewUrl, startCamera]);

  const confirm = useCallback(async () => {
    if (!blob || !consentAccepted) return;
    setPhase("uploading");
    setError(null);
    try {
      await submitLiveMedia({
        sessionId,
        roundId,
        deviceId,
        mediaType: "photo",
        blob,
        mimeType: "image/jpeg",
        ext: "jpg",
        consentAccepted,
      });
      setPhase("done");
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setPhase("error");
    }
  }, [blob, consentAccepted, deviceId, onSubmitted, roundId, sessionId]);

  return (
    <div className="w-full max-w-md mx-auto">
      <p className="text-center text-lg font-medium text-white">{promptText}</p>
      {hint ? <p className="mt-1 text-center text-sm text-gray-400">{hint}</p> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-800 bg-black aspect-[3/4]">
        {phase === "preview" || phase === "uploading" || phase === "done" ? (
          previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Your selfie" className="h-full w-full object-cover" />
          ) : null
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover scale-x-[-1]"
          />
        )}
      </div>

      {error ? <p className="mt-3 text-center text-sm text-red-400">{error}</p> : null}

      <div className="mt-4 flex flex-col gap-2">
        {phase === "ready" && (
          <button
            type="button"
            onClick={capture}
            className="rounded-xl bg-[var(--csc-accent,#CFFF81)] px-4 py-3 text-sm font-semibold text-gray-900"
          >
            Take selfie
          </button>
        )}
        {phase === "preview" && (
          <>
            <button
              type="button"
              onClick={confirm}
              className="rounded-xl bg-[var(--csc-accent,#CFFF81)] px-4 py-3 text-sm font-semibold text-gray-900"
            >
              Send to the room
            </button>
            <button
              type="button"
              onClick={retake}
              className="rounded-xl border border-gray-700 px-4 py-3 text-sm text-gray-200"
            >
              Retake
            </button>
          </>
        )}
        {phase === "uploading" && (
          <p className="text-center text-sm text-gray-400">Sending…</p>
        )}
        {phase === "done" && (
          <p className="text-center text-sm text-[var(--csc-accent,#CFFF81)]">You&apos;re on the wall.</p>
        )}
        {phase === "error" && (
          <button
            type="button"
            onClick={retake}
            className="rounded-xl border border-gray-700 px-4 py-3 text-sm text-gray-200"
          >
            Try again
          </button>
        )}
        {(phase === "boot" || phase === "ready") && phase !== "ready" ? (
          <p className="text-center text-sm text-gray-500">Starting camera…</p>
        ) : null}
      </div>
    </div>
  );
}
