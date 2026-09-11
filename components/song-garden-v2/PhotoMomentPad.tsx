"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import TypewriterText from "@/components/TypewriterText";

// #region agent log
function dbgLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown> = {}) {
  const payload = { hypothesisId, location, message, data, timestamp: Date.now() };
  console.info(message, data);
  void fetch("/api/_debug/agent-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
// #endregion

type PadPhase = "idle" | "preview" | "review" | "uploading" | "done" | "error";

type PhotoMomentPadProps = {
  promptText: string;
  buttonLabel?: string;
  accentColor: string;
  disabled?: boolean;
  hint?: string | null;
  /** When true, parent already shows the question on the same card. */
  hidePrompt?: boolean;
  /** When true, parent already shows helper text on the same card. */
  hideHint?: boolean;
  /** Called with a JPEG blob when the participant keeps the snapshot. */
  onSubmitted: (blob: Blob) => void | Promise<void>;
};

/**
 * Still-photo capture for journey prompts — open camera, snap, review, keep.
 * Prefers the environment (rear) camera so people can show their world.
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
    if (phase === "preview") attachLivePreview();
  }, [phase, attachLivePreview]);

  const openCamera = useCallback(async () => {
    setError(null);
    cancelledRef.current = false;
    // #region agent log
    const secure = typeof window !== "undefined" ? window.isSecureContext : null;
    const hasMD = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
    dbgLog("A,E", "PhotoMomentPad.tsx:openCamera:start", "[PhotoMomentPad] openCamera start", {
      secure,
      hasMD,
      phase,
      disabled,
    });
    // #endregion
    try {
      const stream = await navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
          },
          audio: false,
        })
        .catch(() =>
          navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          })
        );

      // #region agent log
      dbgLog("A", "PhotoMomentPad.tsx:openCamera:gotStream", "[PhotoMomentPad] getUserMedia resolved", {
        cancelled: cancelledRef.current,
        tracks: stream.getTracks().length,
      });
      // #endregion

      if (cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      setPhase("preview");
    } catch (err) {
      // #region agent log
      dbgLog("C,E", "PhotoMomentPad.tsx:openCamera:catch", "[PhotoMomentPad] openCamera failed", {
        err: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : typeof err,
      });
      // #endregion
      releaseStream();
      setPhase("error");
      setError(err instanceof Error ? err.message : "Could not open the camera. Try again.");
      window.setTimeout(() => setPhase((p) => (p === "error" ? "idle" : p)), 1800);
    }
  }, [releaseStream, phase, disabled]);

  const snapPhoto = useCallback(async () => {
    const video = liveVideoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    try {
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
      window.setTimeout(() => setPhase((p) => (p === "error" ? "idle" : p)), 1800);
    }
  }, [releaseStream]);

  const handleIdleTap = useCallback(() => {
    // #region agent log
    dbgLog("B", "PhotoMomentPad.tsx:handleIdleTap", "[PhotoMomentPad] idle tap", {
      disabled,
      phase,
      willOpen: !disabled && (phase === "idle" || phase === "error"),
    });
    // #endregion
    if (disabled) return;
    if (phase !== "idle" && phase !== "error") return;
    void openCamera();
  }, [disabled, openCamera, phase]);

  const handleRetry = useCallback(() => {
    setPendingBlob(null);
    setPhase("idle");
    void openCamera();
  }, [openCamera]);

  const handleKeep = useCallback(async () => {
    // #region agent log
    dbgLog("D", "PhotoMomentPad.tsx:handleKeep", "[PhotoMomentPad] keep pressed", {
      hasBlob: !!pendingBlob,
      disabled,
      blobSize: pendingBlob?.size ?? null,
    });
    // #endregion
    if (!pendingBlob || disabled) return;
    setPhase("uploading");
    setError(null);
    try {
      await onSubmitted(pendingBlob);
      // #region agent log
      dbgLog("D", "PhotoMomentPad.tsx:handleKeep:done", "[PhotoMomentPad] onSubmitted resolved", {});
      // #endregion
      setPendingBlob(null);
      setPhase("done");
    } catch (err) {
      // #region agent log
      dbgLog("D", "PhotoMomentPad.tsx:handleKeep:err", "[PhotoMomentPad] onSubmitted failed", {
        err: err instanceof Error ? err.message : String(err),
      });
      // #endregion
      setPhase("review");
      setError(err instanceof Error ? err.message : "Couldn't send that. Try again.");
    }
  }, [disabled, onSubmitted, pendingBlob]);

  const handleCancelPreview = useCallback(() => {
    releaseStream();
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
        <p className={`${hidePrompt ? "" : "-mt-3 "}font-mono text-xs`} style={{ color: accentColor, opacity: 0.85 }}>
          {hint}
        </p>
      ) : null}

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
            strokeDashoffset={phase === "preview" || phase === "review" ? 0 : 2 * Math.PI * 45 * 0.85}
          />
        </svg>

        {phase === "preview" && (
          <video
            ref={liveVideoRef}
            autoPlay
            playsInline
            muted
            className="pointer-events-none absolute h-28 w-28 rounded-full object-cover"
            aria-hidden
          />
        )}

        {phase === "review" && previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- blob preview
          <img
            src={previewUrl}
            alt=""
            className="pointer-events-none absolute h-28 w-28 rounded-full object-cover"
          />
        )}

        {(phase === "idle" || phase === "error" || phase === "done") && (
          <motion.button
            type="button"
            onClick={handleIdleTap}
            disabled={disabled || phase === "done"}
            whileTap={{ scale: 0.96 }}
            className="relative z-10 flex h-28 w-28 select-none flex-col items-center justify-center rounded-full font-mono text-xs font-semibold uppercase tracking-wide [touch-action:manipulation] disabled:opacity-40"
            style={{
              background: `${accentColor}1f`,
              color: accentColor,
              border: `2px solid ${accentColor}`,
            }}
          >
            {phase === "done" ? "✓" : label}
          </motion.button>
        )}

        {phase === "preview" && (
          <motion.button
            type="button"
            onClick={() => void snapPhoto()}
            whileTap={{ scale: 0.96 }}
            className="relative z-10 flex h-28 w-28 select-none flex-col items-center justify-center rounded-full bg-black/35 font-mono text-xs font-semibold uppercase tracking-wide text-white [touch-action:manipulation]"
          >
            Snap
          </motion.button>
        )}

        {phase === "uploading" && (
          <div className="relative z-10 font-mono text-xs" style={{ color: accentColor }}>
            Sending…
          </div>
        )}
      </div>

      {phase === "preview" && (
        <button
          type="button"
          onClick={handleCancelPreview}
          className="mx-auto block font-mono text-xs text-gray-400 underline decoration-white/20 underline-offset-4 hover:text-gray-200"
        >
          Cancel
        </button>
      )}

      {phase === "review" && (
        <div className="mx-auto flex max-w-xs gap-2">
          <button
            type="button"
            onClick={handleRetry}
            className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-white/20 font-mono text-xs text-gray-200"
          >
            Retake
          </button>
          <motion.button
            type="button"
            onClick={() => void handleKeep()}
            whileTap={{ scale: 0.97 }}
            className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl font-mono text-xs font-semibold"
            style={{ background: accentColor, color: "#1a1530" }}
          >
            Keep
          </motion.button>
        </div>
      )}

      {error && <p className="font-mono text-xs text-red-300">{error}</p>}
    </div>
  );
}
