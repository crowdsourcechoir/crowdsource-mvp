"use client";

import { useCallback, useRef, useState } from "react";
import TypewriterText from "@/components/TypewriterText";
import PadButton, { type PadState } from "@/components/songgarden/PadButton";
import { submitSonggardenClip, getSonggardenContributorName } from "@/data/songgardenClient";
import {
  ANYTHING_ELSE_SLOT,
  BEAT_SLOTS,
  CHOIR_SLOTS,
  ONE_WORD_SLOT,
  REQUIRED_SLOT_IDS,
  type GardenSlotDef,
  type GardenSlotId,
  gardenSlotById,
} from "@/lib/songgarden/garden-slots";
import { prepareWavFromBlob } from "@/lib/songgarden/prepare-audio";
import { playAudioBlob, playRecordStartCue, prefetchMicStream, startQuickRecord } from "@/lib/songgarden/quick-record";
import { playReferenceTone } from "@/lib/songgarden/reference-tones";
import { runPadCountdown } from "@/lib/songgarden/pad-countdown";
import { sanitizeSoundFilename } from "@/lib/songgarden/categories";
import { loadDoneSlots, saveDoneSlot, clearDoneSlots } from "@/lib/songgarden/garden-storage";
import type { ResolvedGardenStep } from "@/lib/songgarden/config";
import UploadConsentCheckbox from "@/components/songgarden/UploadConsentCheckbox";

type SoundGardenExperienceProps = {
  eventId: string;
  onSubmitted?: () => void;
  /** Single-slot journey mode — one pad at a time */
  mode?: "grid" | "single";
  activeSlotId?: GardenSlotId;
  activeStep?: ResolvedGardenStep;
  onSlotComplete?: (slotId: GardenSlotId) => void;
  onDoneSlotsChange?: (done: Set<GardenSlotId>) => void;
  hideIntro?: boolean;
  hideProgress?: boolean;
  contributorName?: string | null;
};

const SONG_GARDEN_INTRO = "Before the show, let's add sounds that we can use live.";
const SONG_GARDEN_COMPLETE_MESSAGE =
  "Thanks! Your sounds have been planted in the Song Garden. Feel free to add more sounds.";
const SILENCE_LEVEL = 0.07;
const SILENCE_CHECK_AFTER_MS = 1000;

function emptyPadStates(): Record<GardenSlotId, PadState> {
  return {
    stomp: "idle",
    clap: "idle",
    snap: "idle",
    tap: "idle",
    low: "idle",
    mid: "idle",
    higher: "idle",
    highest: "idle",
    one_word: "idle",
    anything_else: "idle",
  };
}

function initialPadStates(eventId: string): Record<GardenSlotId, PadState> {
  const done = loadDoneSlots(eventId);
  const base = (id: GardenSlotId): PadState => (done.has(id) ? "done" : "idle");
  return {
    stomp: base("stomp"),
    clap: base("clap"),
    snap: base("snap"),
    tap: base("tap"),
    low: base("low"),
    mid: base("mid"),
    higher: base("higher"),
    highest: base("highest"),
    one_word: base("one_word"),
    anything_else: base("anything_else"),
  };
}

export default function SoundGardenExperience({
  eventId,
  onSubmitted,
  mode = "grid",
  activeSlotId,
  activeStep,
  onSlotComplete,
  onDoneSlotsChange,
  hideIntro = false,
  hideProgress = false,
  contributorName,
}: SoundGardenExperienceProps) {
  const [padStates, setPadStates] = useState<Record<GardenSlotId, PadState>>(() =>
    initialPadStates(eventId)
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [countdownByPad, setCountdownByPad] = useState<Partial<Record<GardenSlotId, number>>>({});
  const [recordSecondsByPad, setRecordSecondsByPad] = useState<Partial<Record<GardenSlotId, number>>>({});
  const [recordProgressByPad, setRecordProgressByPad] = useState<Partial<Record<GardenSlotId, number>>>({});
  const [audioLevelByPad, setAudioLevelByPad] = useState<Partial<Record<GardenSlotId, number>>>({});
  const [silenceWarningByPad, setSilenceWarningByPad] = useState<Partial<Record<GardenSlotId, boolean>>>({});
  const [activeRecordingSlot, setActiveRecordingSlot] = useState<GardenSlotId | null>(null);
  const [review, setReview] = useState<{ slotId: GardenSlotId; clip: Blob } | null>(null);
  const [playingReview, setPlayingReview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const recordStopRef = useRef<(() => void) | null>(null);
  const [uploadConsentAgreed, setUploadConsentAgreed] = useState(false);

  const inReview = review != null;
  const reviewSlot = review?.slotId ?? null;
  const pendingClip = review?.clip ?? null;

  const requiredDone = REQUIRED_SLOT_IDS.filter((id) => padStates[id] === "done").length;
  const progressPct = Math.round((requiredDone / REQUIRED_SLOT_IDS.length) * 100);
  const isComplete = requiredDone === REQUIRED_SLOT_IDS.length;

  const setPad = useCallback((id: GardenSlotId, state: PadState) => {
    setPadStates((prev) => ({ ...prev, [id]: state }));
  }, []);

  const stopPlayback = useCallback(() => {
    if (playbackRef.current) {
      playbackRef.current.pause();
      playbackRef.current = null;
    }
    setPlayingReview(false);
  }, []);

  const clearRecordFeedback = useCallback((id: GardenSlotId) => {
    setRecordSecondsByPad((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setRecordProgressByPad((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setAudioLevelByPad((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSilenceWarningByPad((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const stopActiveRecording = useCallback(() => {
    recordStopRef.current?.();
  }, []);

  const recordWithFeedback = useCallback(
    async (slotId: GardenSlotId, durationMs: number, stream?: MediaStream) => {
      setSilenceWarningByPad((prev) => {
        const next = { ...prev };
        delete next[slotId];
        return next;
      });

      let peakLevel = 0;

      const handle = startQuickRecord(
        durationMs,
        ({ remainingMs, totalMs, level }) => {
          peakLevel = Math.max(peakLevel, level);
          const elapsed = totalMs - remainingMs;

          setRecordSecondsByPad((prev) => ({
            ...prev,
            [slotId]: Math.max(0, Math.ceil(remainingMs / 1000)),
          }));
          setRecordProgressByPad((prev) => ({
            ...prev,
            [slotId]: totalMs > 0 ? 1 - remainingMs / totalMs : 0,
          }));
          setAudioLevelByPad((prev) => ({
            ...prev,
            [slotId]: level,
          }));

          if (level > 0.11) {
            setSilenceWarningByPad((prev) => {
              if (!prev[slotId]) return prev;
              const next = { ...prev };
              delete next[slotId];
              return next;
            });
          } else if (elapsed >= SILENCE_CHECK_AFTER_MS && peakLevel < SILENCE_LEVEL) {
            setSilenceWarningByPad((prev) => ({ ...prev, [slotId]: true }));
          }
        },
        {
          stream,
          onRecordingStarted: playRecordStartCue,
        }
      );

      recordStopRef.current = handle.stop;
      setActiveRecordingSlot(slotId);

      try {
        return await handle.promise;
      } finally {
        recordStopRef.current = null;
        setActiveRecordingSlot(null);
        setSilenceWarningByPad((prev) => {
          const next = { ...prev };
          delete next[slotId];
          return next;
        });
      }
    },
    []
  );

  const submitSlot = useCallback(
    async (slot: GardenSlotDef, source: Blob) => {
      const { blob, durationMs } = await prepareWavFromBlob(source);
      const filename = sanitizeSoundFilename(slot.label.toLowerCase().replace(/\s+/g, "-"), "wav");
      const credit =
        contributorName?.trim() || getSonggardenContributorName(eventId)?.trim() || null;
      await submitSonggardenClip({
        eventId,
        category: slot.category,
        audio: blob,
        filename,
        contributorName: credit,
        label: slot.label,
        durationMs,
      });
      saveDoneSlot(eventId, slot.id);
      setPad(slot.id, "done");
      onDoneSlotsChange?.(loadDoneSlots(eventId));
      onSubmitted?.();
      if (mode === "single") {
        onSlotComplete?.(slot.id);
      }
    },
    [contributorName, eventId, mode, onDoneSlotsChange, onSlotComplete, onSubmitted, setPad]
  );

  const previewTake = useCallback(async () => {
    if (!pendingClip) return;
    stopPlayback();
    setPlayingReview(true);
    try {
      await playAudioBlob(pendingClip, playbackRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Playback failed.");
    } finally {
      setPlayingReview(false);
    }
  }, [pendingClip, stopPlayback]);

  const playReviewTone = useCallback(async () => {
    if (!reviewSlot) return;
    const slot = gardenSlotById(reviewSlot);
    if (!slot?.harmonyDegree) return;
    stopPlayback();
    setPlayingReview(true);
    try {
      await playReferenceTone(slot.harmonyDegree);
    } finally {
      setPlayingReview(false);
    }
  }, [reviewSlot, stopPlayback]);

  const keepTake = useCallback(async () => {
    if (!reviewSlot || !pendingClip) return;
    const slot = gardenSlotById(reviewSlot);
    if (!slot) return;

    setBusy(true);
    setError(null);
    stopPlayback();
    setPad(reviewSlot, "uploading");
    try {
      await submitSlot(slot, pendingClip);
      setReview(null);
    } catch (err) {
      setPad(reviewSlot, "review");
      setError(err instanceof Error ? err.message : "Could not add that sound. Try again.");
    } finally {
      setBusy(false);
    }
  }, [pendingClip, reviewSlot, setPad, stopPlayback, submitSlot]);

  const runSlot = useCallback(
    async (
      slot: GardenSlotDef,
      options?: { playTone?: boolean; ignoreReviewBlock?: boolean }
    ) => {
      if (busy) return;
      if (inReview && !options?.ignoreReviewBlock) return;
      setBusy(true);
      setError(null);
      stopPlayback();

      try {
        if (options?.playTone && slot.harmonyDegree) {
          setPad(slot.id, "active");
          await playReferenceTone(slot.harmonyDegree);
        }

        setPad(slot.id, "countdown");
        const micReady = prefetchMicStream();
        await runPadCountdown((n) => {
          setCountdownByPad((prev) => ({ ...prev, [slot.id]: n }));
        });
        setCountdownByPad((prev) => {
          const next = { ...prev };
          delete next[slot.id];
          return next;
        });

        setPad(slot.id, "recording");
        const micStream = await micReady;
        const raw = await recordWithFeedback(slot.id, slot.recordMs, micStream);
        clearRecordFeedback(slot.id);

        setReview({ slotId: slot.id, clip: raw });
        setPad(slot.id, "review");
        return;
      } catch (err) {
        setCountdownByPad((prev) => {
          const next = { ...prev };
          delete next[slot.id];
          return next;
        });
        clearRecordFeedback(slot.id);
        setPad(slot.id, "error");
        setError(err instanceof Error ? err.message : "Could not add that sound. Try again.");
        window.setTimeout(() => {
          setPadStates((prev) =>
            prev[slot.id] === "done" ? prev : { ...prev, [slot.id]: "idle" }
          );
        }, 2000);
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      inReview,
      clearRecordFeedback,
      recordWithFeedback,
      setPad,
      stopPlayback,
    ]
  );

  const retryTake = useCallback(() => {
    if (!reviewSlot) return;
    const slot = gardenSlotById(reviewSlot);
    if (!slot) return;
    const slotId = reviewSlot;
    stopPlayback();
    setReview(null);
    setPad(slotId, "idle");
    void runSlot(slot, { playTone: !!slot.harmonyDegree, ignoreReviewBlock: true });
  }, [reviewSlot, runSlot, setPad, stopPlayback]);

  const resetGarden = useCallback(() => {
    if (busy) return;
    stopPlayback();
    clearDoneSlots(eventId);
    setReview(null);
    setCountdownByPad({});
    setRecordSecondsByPad({});
    setRecordProgressByPad({});
    setAudioLevelByPad({});
    setSilenceWarningByPad({});
    setActiveRecordingSlot(null);
    setError(null);
    setPadStates(emptyPadStates());
  }, [busy, eventId, stopPlayback]);

  async function handleUpload(file: File) {
    if (busy) return;
    if (!uploadConsentAgreed) {
      setError("Please confirm you have permission to share this recording.");
      return;
    }
    if (!file.type.startsWith("audio/")) {
      setError("Please choose an audio file.");
      return;
    }
    setBusy(true);
    setError(null);
    setPad("anything_else", "uploading");
    try {
      await submitSlot(ANYTHING_ELSE_SLOT, file);
    } catch (err) {
      setPad("anything_else", "error");
      setError(err instanceof Error ? err.message : "Upload failed.");
      window.setTimeout(() => setPad("anything_else", "idle"), 2000);
    } finally {
      setBusy(false);
    }
  }

  const padRecordProps = (id: GardenSlotId) => ({
    countdown: countdownByPad[id],
    recordSecondsLeft: recordSecondsByPad[id],
    recordProgress: recordProgressByPad[id],
    audioLevel: audioLevelByPad[id],
    silenceWarning: silenceWarningByPad[id],
    onStopRecording:
      padStates[id] === "recording" && activeRecordingSlot === id ? stopActiveRecording : undefined,
  });

  const padReviewProps = (id: GardenSlotId) => {
    if (padStates[id] !== "review" || reviewSlot !== id) return {};
    const slot = gardenSlotById(id);
    return {
      onPreview: () => void previewTake(),
      onRetry: () => retryTake(),
      onKeep: () => void keepTake(),
      onPlayTone: slot?.harmonyDegree ? () => void playReviewTone() : undefined,
      previewPlaying: playingReview,
    };
  };

  const padDisabled = (id: GardenSlotId) =>
    (busy && activeRecordingSlot !== id) || (inReview && reviewSlot !== id);

  const singleSlot =
    mode === "single" && activeSlotId ? gardenSlotById(activeSlotId) : null;

  if (mode === "single" && singleSlot) {
    const isChoir = !!singleSlot.harmonyDegree;
    const isAnythingElse = singleSlot.id === "anything_else";
    const phaseLabel = activeStep?.phaseLabel ?? "";
    const promptText = activeStep?.prompt ?? singleSlot.label;
    const recordLabel =
      activeStep?.buttonLabel ??
      (isAnythingElse ? "RECORD" : singleSlot.label);
    return (
      <div className="mx-auto w-full max-w-lg space-y-6 font-mono text-left">
        <div>
          {phaseLabel ? (
            <p className="text-center text-[10px] font-medium tracking-[0.2em] text-[var(--crowdsource-accent)]">
              {phaseLabel}
            </p>
          ) : null}
          <p className="mt-3 text-center font-mono text-[1.0625rem] leading-snug text-gray-200 sm:text-lg">
            {promptText}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <PadButton
            label={recordLabel}
            fullWidth
            journeyStyle
            state={padStates[singleSlot.id]}
            {...padRecordProps(singleSlot.id)}
            {...padReviewProps(singleSlot.id)}
            disabled={padDisabled(singleSlot.id)}
            recordingHint={isChoir ? "● sing OHH" : "● rec"}
            onClick={() =>
              void runSlot(singleSlot, { playTone: isChoir })
            }
          />
          {isAnythingElse && (
            <>
              <p className="text-center text-xs tracking-wide text-gray-400">or</p>
              <PadButton
                label="UPLOAD"
                fullWidth
                journeyStyle
                state={padStates.anything_else === "done" ? "done" : "idle"}
                disabled={busy || !uploadConsentAgreed}
                onClick={() => fileInputRef.current?.click()}
              />
              <UploadConsentCheckbox
                checked={uploadConsentAgreed}
                onChange={setUploadConsentAgreed}
                className="px-1"
              />
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
            e.target.value = "";
          }}
        />
        {error && <p className="text-center text-sm text-red-300">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-10 font-mono">
      {!hideIntro && (
        <div className="min-h-[76px] py-2 sm:min-h-[100px] sm:py-4">
          <p className="mx-auto max-w-xl font-mono text-base leading-snug text-gray-200 sm:text-lg">
            <TypewriterText
              key="songgarden-intro"
              text={SONG_GARDEN_INTRO}
              speed={9}
              className="inline"
            />
          </p>
        </div>
      )}

      {!hideProgress && !isComplete && (
        <div>
          <div className="h-1 overflow-hidden bg-white/10">
            <div
              className="h-full bg-[var(--crowdsource-accent)] transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-2 text-center text-[10px] tracking-wide text-gray-400">
            {requiredDone} of {REQUIRED_SLOT_IDS.length} layers
          </p>
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-center text-sm font-medium tracking-[0.2em] text-[var(--crowdsource-accent)]">
            BUILD THE BEAT
          </h2>
          <p className="mt-1 text-xs text-gray-300">Add a few sounds to tonight&apos;s rhythm.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {BEAT_SLOTS.map((slot) => (
            <PadButton
              key={slot.id}
              label={slot.label}
              state={padStates[slot.id]}
              {...padRecordProps(slot.id)}
              {...padReviewProps(slot.id)}
              disabled={padDisabled(slot.id)}
              onClick={() => void runSlot(slot)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium tracking-[0.2em] text-[var(--crowdsource-accent)]">
            BUILD THE CHOIR
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-300">
            Let&apos;s make a choral bed with our own voices. Sing OHH the same pitch as the tone.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {CHOIR_SLOTS.map((slot) => (
            <PadButton
              key={slot.id}
              label={slot.label}
              state={padStates[slot.id]}
              {...padRecordProps(slot.id)}
              {...padReviewProps(slot.id)}
              recordingHint="● sing OHH"
              disabled={padDisabled(slot.id)}
              onClick={() => void runSlot(slot, { playTone: true })}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium tracking-[0.2em] text-[var(--crowdsource-accent)]">ONE WORD</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-200">
            When you think of summer, what&apos;s the first word that comes to mind?
          </p>
          <p className="mt-1 text-xs text-gray-400">Sing it.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <PadButton
            label="SING IT"
            large
            fullWidth
            state={padStates.one_word}
            {...padRecordProps("one_word")}
            {...padReviewProps("one_word")}
            disabled={padDisabled("one_word")}
            onClick={() => void runSlot(ONE_WORD_SLOT)}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium tracking-[0.2em] text-[var(--crowdsource-accent)]">
            ONE MORE
          </h2>
          <p className="mt-1 text-xs text-gray-300">
            Your voice, your dog, the room around you — anything.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <PadButton
            label="RECORD"
            fullWidth
            journeyStyle
            state={padStates.anything_else}
            {...padRecordProps("anything_else")}
            {...padReviewProps("anything_else")}
            disabled={padDisabled("anything_else")}
            onClick={() => void runSlot(ANYTHING_ELSE_SLOT)}
          />
          <p className="text-center text-xs tracking-wide text-gray-400">or</p>
          <PadButton
            label="UPLOAD"
            fullWidth
            journeyStyle
            state={padStates.anything_else === "done" ? "done" : "idle"}
            disabled={busy || !uploadConsentAgreed}
            onClick={() => fileInputRef.current?.click()}
          />
          <UploadConsentCheckbox
            checked={uploadConsentAgreed}
            onChange={setUploadConsentAgreed}
            className="px-1"
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
            e.target.value = "";
          }}
        />
      </section>

      {isComplete && (
        <div className="space-y-4 text-center">
          <p className="mx-auto max-w-md font-mono text-base leading-snug text-gray-200 sm:text-lg">
            <TypewriterText
              key="songgarden-complete"
              text={SONG_GARDEN_COMPLETE_MESSAGE}
              speed={9}
              className="inline"
            />
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={resetGarden}
            className="crowdsource-btn-outline"
          >
            Add more sounds
          </button>
        </div>
      )}

      {error && <p className="text-center text-sm text-red-300">{error}</p>}
    </div>
  );
}
