"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import TypewriterText from "@/components/TypewriterText";
import CameraCaptureShell from "./CameraCaptureShell";

type PadPhase =
  | "idle"
  | "opening"
  | "preview"
  | "review"
  | "uploading"
  | "done"
  | "error";

const RING_CIRC = 2 * Math.PI * 45;
const CAMERA_TIMEOUT_MS = 20_000;

type PhotoMomentPadProps = {
  promptText: string;
  buttonLabel?: string;
  accentColor: string;
  /**
   * Blocks Keep/upload only. Opening the camera stays available so conversation
   * bootstrap (`sending` in WorldJourney) cannot silently freeze Snap.
   */
  disabled?: boolean;
  hint?: string | null;
  /** When true, parent already shows the question on the same card. */
  hidePrompt?: boolean;
  /** When true, parent already shows helper text on the same card. */
  hideHint?: boolean;
  /** Called with a JPEG blob when the participant keeps the snapshot. */
  onSubmitted: (blob: Blob) => void | Promise<void>;
};

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission blocked. Allow camera access and try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera found on this device.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Camera is busy in another app. Close it and try again.";
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return "Could not open the camera. Try again.";
}

async function getCameraStream(): Promise<MediaStream> {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new Error("Camera needs a secure connection (HTTPS).");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera isn't available in this browser.");
  }

  const withTimeout = <T,>(promise: Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new Error("Camera is taking too long. Check permissions and try again."));
      }, CAMERA_TIMEOUT_MS);
      promise.then(
        (value) => {
          window.clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          window.clearTimeout(timer);
          reject(err);
        }
      );
    });

  try {
    return await withTimeout(
      navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
        },
        audio: false,
      })
    );
  } catch (firstErr) {
    if (
      firstErr instanceof Error &&
      /taking too long|secure connection|isn't available/i.test(firstErr.message)
    ) {
      throw firstErr;
    }
    return await withTimeout(
      navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      })
    );
  }
}

/**
 * Still-photo capture for journey prompts.
 * Idle Snap stays on the glass card; once the camera opens we switch to a
 * full-screen phone-camera viewfinder (large preview + bottom shutter).
 */
export default function PhotoMomentPad({
  promptText,
  buttonLabel = "Snap",
  accentColor,
  disabled = false,
  hint,
  hidePrompt = false,
  hideHint = false,
  onSubmitted,
}: PhotoMomentPadProps) {
  const [phase, setPhase] = useState<PadPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);

  const label = buttonLabel.trim() || "Snap";
  const inCameraUi =
    phase === "opening" || phase === "preview" || phase === "review" || phase === "uploading";

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      releaseStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup once on unmount
  }, []);

  useEffect(() => {
    if (!pendingBlob) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(pendingBlob);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, [pendingBlob]);

  const attachLivePreview = useCallback(() => {
    const video = liveVideoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.muted = true;
    void video.play().catch(() => {});
  }, []);

  useEffect(() => {
    if (phase === "preview" || phase === "opening") attachLivePreview();
  }, [phase, attachLivePreview]);

  const openCamera = useCallback(async () => {
    setError(null);
    cancelledRef.current = false;
    setPhase("opening");
    try {
      const stream = await getCameraStream();

      if (cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      setPhase("preview");
    } catch (err) {
      releaseStream();
      setPhase("error");
      setError(cameraErrorMessage(err));
      const sticky =
        (err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) ||
        (err instanceof Error &&
          /secure connection|isn't available|taking too long/i.test(err.message));
      window.setTimeout(
        () => setPhase((p) => (p === "error" ? "idle" : p)),
        sticky ? 5000 : 2200
      );
    }
  }, [releaseStream]);

  const snapPhoto = useCallback(async () => {
    const video = liveVideoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    try {
      if (!video.videoWidth || !video.videoHeight) {
        await new Promise((r) => window.setTimeout(r, 250));
      }
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not capture that. Try again.");
      ctx.drawImage(video, 0, 0, w, h);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Could not capture that. Try again."))),
          "image/jpeg",
          0.92
        );
      });

      releaseStream();
      setPendingBlob(blob);
      setPhase("review");
    } catch (err) {
      releaseStream();
      setPhase("error");
      setError(err instanceof Error ? err.message : "Could not capture that. Try again.");
      window.setTimeout(() => setPhase((p) => (p === "error" ? "idle" : p)), 2200);
    }
  }, [releaseStream]);

  const handleIdleTap = useCallback(() => {
    if (phase !== "idle" && phase !== "error") return;
    void openCamera();
  }, [openCamera, phase]);

  const handleRetry = useCallback(() => {
    setPendingBlob(null);
    setError(null);
    setPhase("idle");
    void openCamera();
  }, [openCamera]);

  const handleKeep = useCallback(async () => {
    if (!pendingBlob || disabled) return;
    setPhase("uploading");
    setError(null);
    try {
      await onSubmitted(pendingBlob);
      setPendingBlob(null);
      setPhase("done");
    } catch (err) {
      setPhase("review");
      setError(err instanceof Error ? err.message : "Couldn't send that. Try again.");
    }
  }, [disabled, onSubmitted, pendingBlob]);

  const handleCancelCamera = useCallback(() => {
    cancelledRef.current = true;
    releaseStream();
    setPendingBlob(null);
    setPhase("idle");
  }, [releaseStream]);

  return (
    <div className={`text-center ${hidePrompt ? "space-y-4" : "space-y-6"}`}>
      {!hidePrompt && (
        <p className="mx-auto max-w-xs font-mono text-[1.0625rem] leading-snug text-gray-100 sm:text-lg">
          <TypewriterText key={promptText} text={promptText} speed={9} className="inline" />
        </p>
      )}
      {!hideHint && hint ? (
        <p
          className={`${hidePrompt ? "" : "-mt-3 "}font-mono text-xs`}
          style={{ color: accentColor, opacity: 0.85 }}
        >
          {hint}
        </p>
      ) : null}

      {/* Idle circle CTA on the glass card */}
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
              strokeDasharray={RING_CIRC}
              strokeDashoffset={RING_CIRC * 0.85}
            />
          </svg>
          <motion.button
            type="button"
            onClick={handleIdleTap}
            disabled={phase === "done"}
            whileTap={{ scale: 0.96 }}
            className="relative z-10 flex h-28 w-28 select-none flex-col items-center justify-center rounded-full font-mono text-xs font-semibold uppercase tracking-wide [touch-action:manipulation] disabled:opacity-70"
            style={{
              background: `${accentColor}1f`,
              color: accentColor,
              border: `2px solid ${accentColor}`,
            }}
          >
            {phase === "done" ? "✓" : label}
          </motion.button>
        </div>
      )}

      {error && !inCameraUi ? <p className="font-mono text-xs text-red-300">{error}</p> : null}

      {inCameraUi ? (
        <CameraCaptureShell
          modeLabel="PHOTO"
          accentColor={accentColor}
          onClose={handleCancelCamera}
          status={
            phase === "opening"
              ? "Opening camera…"
              : phase === "uploading"
                ? "Sending…"
                : phase === "review"
                  ? "Looks good?"
                  : null
          }
          media={
            <>
              {(phase === "opening" || phase === "preview") && (
                <video
                  ref={liveVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              {(phase === "review" || phase === "uploading") && previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- blob preview
                <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
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
              <button
                type="button"
                onClick={handleRetry}
                disabled={disabled || phase === "uploading"}
                className="min-h-[44px] rounded-full px-2 font-mono text-xs text-white/90 disabled:opacity-40"
              >
                Retake
              </button>
            ) : (
              <span />
            )
          }
          shutter={
            phase === "preview" || phase === "opening" ? (
              <motion.button
                type="button"
                aria-label="Take photo"
                disabled={phase === "opening"}
                onClick={() => void snapPhoto()}
                whileTap={{ scale: 0.94 }}
                className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[4px] border-white bg-white disabled:opacity-50"
              >
                <span className="h-[58px] w-[58px] rounded-full bg-white ring-2 ring-black/20" />
              </motion.button>
            ) : (
              <motion.button
                type="button"
                aria-label="Keep photo"
                disabled={disabled || phase === "uploading"}
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
