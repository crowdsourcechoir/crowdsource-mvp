"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { submitSonggardenClip, getSonggardenContributorName } from "@/data/songgardenClient";
import type { GardenSlotDef } from "@/lib/songgarden/garden-slots";
import { prepareWavFromBlob } from "@/lib/songgarden/prepare-audio";
import {
  playAudioBlob,
  playRecordStartCue,
  prefetchMicStream,
  startQuickRecord,
} from "@/lib/songgarden/quick-record";
import { playReferenceTone, unlockReferenceTones } from "@/lib/songgarden/reference-tones";
import { runPadCountdown } from "@/lib/songgarden/pad-countdown";
import { sanitizeSoundFilename } from "@/lib/songgarden/categories";
import { saveDoneSlot } from "@/lib/songgarden/garden-storage";

type PadPhase = "choose" | "idle" | "tone" | "countdown" | "recording" | "review" | "uploading" | "done" | "error";

type SoundMomentPadProps = {
  eventId: string;
  slot: GardenSlotDef;
  promptText: string;
  buttonLabel?: string;
  contributorName: string | null;
  accentColor: string;
  /** When set, the participant picks exactly one of [slot, ...alternateSlots] to perform — "add a stomp, clap, or snap" as one moment instead of three. */
  alternateSlots?: GardenSlotDef[];
  /** Called once the clip is durably submitted — parent runs the celebration + advances. */
  onSubmitted: () => void;
};

/**
 * A single Song Garden creative moment. Presentation is new; the actual recording
 * engine (mic capture, countdown, level metering, WAV prep, reference tone,
 * upload) is 100% reused from lib/songgarden/* — only how it looks/feels here is new.
 */
export default function SoundMomentPad({
  eventId,
  slot,
  promptText,
  buttonLabel,
  contributorName,
  accentColor,
  alternateSlots,
  onSubmitted,
}: SoundMomentPadProps) {
  const hasChoices = !!alternateSlots?.length;
  const choices = hasChoices ? [slot, ...alternateSlots!] : [slot];
  const [phase, setPhase] = useState<PadPhase>(hasChoices ? "choose" : "idle");
  const [activeSlot, setActiveSlot] = useState<GardenSlotDef>(slot);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pendingClip, setPendingClip] = useState<Blob | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const isChoir = !!activeSlot.harmonyDegree;
  const label = hasChoices ? activeSlot.label : buttonLabel ?? activeSlot.label;

  const handleChoose = useCallback((chosen: GardenSlotDef) => {
    setActiveSlot(chosen);
    setPhase("idle");
  }, []);

  const stopPlayback = useCallback(() => {
    playbackRef.current?.pause();
    playbackRef.current = null;
    setPreviewPlaying(false);
  }, []);

  const runCapture = useCallback(async () => {
    setError(null);
    try {
      if (isChoir && activeSlot.harmonyDegree) {
        setPhase("tone");
        await playReferenceTone(activeSlot.harmonyDegree);
      }

      setPhase("countdown");
      const micReady = prefetchMicStream();
      await runPadCountdown((n) => setCountdown(n));
      setCountdown(null);

      setPhase("recording");
      const micStream = await micReady;
      let peak = 0;
      const handle = startQuickRecord(
        activeSlot.recordMs,
        ({ remainingMs, totalMs, level: lvl }) => {
          peak = Math.max(peak, lvl);
          setSecondsLeft(Math.max(0, Math.ceil(remainingMs / 1000)));
          setProgress(totalMs > 0 ? 1 - remainingMs / totalMs : 0);
          setLevel(lvl);
        },
        { stream: micStream, onRecordingStarted: playRecordStartCue }
      );
      stopRef.current = handle.stop;
      const clip = await handle.promise;
      stopRef.current = null;
      setSecondsLeft(null);
      setProgress(0);
      setLevel(0);
      setPendingClip(clip);
      setPhase("review");
    } catch (err) {
      stopRef.current = null;
      setCountdown(null);
      setSecondsLeft(null);
      setProgress(0);
      setLevel(0);
      setPhase("error");
      setError(err instanceof Error ? err.message : "Could not capture that. Try again.");
      window.setTimeout(() => setPhase((p) => (p === "error" ? "idle" : p)), 1800);
    }
  }, [isChoir, activeSlot]);

  const handleTap = useCallback(() => {
    unlockReferenceTones();
    if (phase !== "idle" && phase !== "error") return;
    void runCapture();
  }, [phase, runCapture]);

  const handleStopEarly = useCallback(() => {
    stopRef.current?.();
  }, []);

  const handlePreview = useCallback(async () => {
    if (!pendingClip) return;
    stopPlayback();
    setPreviewPlaying(true);
    try {
      await playAudioBlob(pendingClip, playbackRef);
    } finally {
      setPreviewPlaying(false);
    }
  }, [pendingClip, stopPlayback]);

  const handleRetry = useCallback(() => {
    stopPlayback();
    setPendingClip(null);
    setPhase("idle");
    void runCapture();
  }, [runCapture, stopPlayback]);

  const handleKeep = useCallback(async () => {
    if (!pendingClip) return;
    stopPlayback();
    setPhase("uploading");
    try {
      const { blob, durationMs } = await prepareWavFromBlob(pendingClip);
      const filename = sanitizeSoundFilename(activeSlot.label.toLowerCase().replace(/\s+/g, "-"), "wav");
      const credit = contributorName?.trim() || getSonggardenContributorName(eventId)?.trim() || null;
      await submitSonggardenClip({
        eventId,
        category: activeSlot.category,
        audio: blob,
        filename,
        contributorName: credit,
        label: activeSlot.label,
        durationMs,
      });
      // Always mark the *configured* step slot done (not whichever alternate was actually
      // performed) — progress tracking (firstIncompleteGardenIndex) keys off this step's
      // nominal slotId regardless of which choice the participant picked.
      saveDoneSlot(eventId, slot.id);
      setPendingClip(null);
      setPhase("done");
      onSubmitted();
    } catch (err) {
      setPhase("review");
      setError(err instanceof Error ? err.message : "Couldn't add that sound. Try again.");
    }
  }, [activeSlot, contributorName, eventId, onSubmitted, pendingClip, slot, stopPlayback]);

  const ringPct =
    phase === "recording" ? progress : phase === "countdown" && countdown ? 1 - countdown / 3 : 0;

  return (
    <div className="space-y-6 text-center">
      <p className="mx-auto max-w-xs font-mono text-[1.0625rem] leading-snug text-gray-100 sm:text-lg">
        {promptText}
      </p>

      {phase === "choose" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto flex max-w-sm flex-wrap items-center justify-center gap-3"
        >
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => handleChoose(choice)}
              className="flex h-16 w-[5.5rem] shrink-0 select-none items-center justify-center rounded-2xl border px-1 font-mono text-sm font-semibold uppercase tracking-wide [touch-action:manipulation]"
              style={{ borderColor: accentColor, color: accentColor, background: `${accentColor}1f` }}
            >
              {choice.label}
            </button>
          ))}
        </motion.div>
      )}

      {phase !== "choose" && (
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

        <motion.button
          type="button"
          onClick={phase === "recording" ? handleStopEarly : handleTap}
          disabled={
            phase === "tone" || phase === "countdown" || phase === "uploading" || phase === "review" || phase === "done"
          }
          whileTap={{ scale: 0.94 }}
          animate={phase === "done" ? { scale: [1, 1.12, 1] } : {}}
          transition={{ duration: 0.4 }}
          className="flex h-28 w-28 [touch-action:manipulation] select-none flex-col items-center justify-center rounded-full font-mono text-xs font-semibold uppercase tracking-wide transition [-webkit-tap-highlight-color:transparent] [-webkit-user-select:none] disabled:cursor-default"
          style={{
            background:
              phase === "recording"
                ? "rgba(248,113,113,0.18)"
                : phase === "done"
                  ? accentColor
                  : `${accentColor}1f`,
            color: phase === "recording" ? "#fecaca" : phase === "done" ? "#1a1530" : accentColor,
            border: `2px solid ${phase === "recording" ? "#f87171" : accentColor}`,
          }}
        >
          {phase === "idle" && <span>{label}</span>}
          {phase === "error" && <span>Try again</span>}
          {phase === "tone" && <span>Listen…</span>}
          {phase === "countdown" && <span className="text-3xl tabular-nums">{countdown}</span>}
          {phase === "recording" && (
            <>
              <span className="text-2xl tabular-nums">{secondsLeft}s</span>
              <span className="mt-1 text-[10px]">tap to stop</span>
            </>
          )}
          {phase === "uploading" && <span>Adding…</span>}
          {phase === "review" && <span>Got it</span>}
          {phase === "done" && <span className="text-2xl">✓</span>}
        </motion.button>
      </div>
      )}

      {phase === "recording" && (
        <div className="mx-auto flex h-3 w-32 items-end justify-center gap-0.5" aria-hidden>
          {[0.2, 0.4, 0.6, 0.8, 1].map((threshold, i) => (
            <span
              key={i}
              className="w-1.5 rounded-sm transition-all duration-75"
              style={{
                height: `${6 + i * 3}px`,
                background: level >= threshold ? "#f87171" : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>
      )}

      {phase === "review" && pendingClip && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto grid max-w-xs grid-cols-2 gap-2"
        >
          <button
            type="button"
            disabled={previewPlaying}
            onClick={() => void handlePreview()}
            className="min-h-[44px] select-none rounded-xl border px-3 py-2 font-mono text-xs [touch-action:manipulation] disabled:opacity-50"
            style={{ borderColor: accentColor, color: accentColor }}
          >
            {previewPlaying ? "▶ …" : "▶ Listen"}
          </button>
          <button
            type="button"
            disabled={previewPlaying}
            onClick={handleRetry}
            className="min-h-[44px] select-none rounded-xl border px-3 py-2 font-mono text-xs [touch-action:manipulation] disabled:opacity-50"
            style={{ borderColor: accentColor, color: accentColor }}
          >
            ↻ Again
          </button>
          <button
            type="button"
            disabled={previewPlaying}
            onClick={() => void handleKeep()}
            className="col-span-2 min-h-[44px] select-none rounded-xl px-3 py-2 font-mono text-xs font-semibold [touch-action:manipulation] disabled:opacity-50"
            style={{ background: accentColor, color: "#1a1530" }}
          >
            ✓ Add it to the song garden
          </button>
        </motion.div>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
