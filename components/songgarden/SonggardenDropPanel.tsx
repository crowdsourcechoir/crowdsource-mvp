"use client";

import { useCallback, useState } from "react";
import RecordAudio from "@/components/RecordAudio";
import { blobToWavBlob } from "@/lib/audioToWav";
import { SONGGARDEN_CATEGORIES, sanitizeSoundFilename } from "@/lib/songgarden/categories";
import type { SonggardenCategoryId } from "@/lib/songgarden/types";
import UploadConsentCheckbox from "@/components/songgarden/UploadConsentCheckbox";
import FileDropZone from "@/components/ui/FileDropZone";
import {
  getSonggardenContributorName,
  setSonggardenContributorName,
  submitSonggardenClip,
} from "@/data/songgardenClient";

type SonggardenDropPanelProps = {
  eventId: string;
  onSubmitted?: () => void;
};

type InputMode = "record" | "upload";

const fieldClass = "crowdsource-field px-3 py-2.5 text-sm";

export default function SonggardenDropPanel({ eventId, onSubmitted }: SonggardenDropPanelProps) {
  const [mode, setMode] = useState<InputMode>("record");
  const [category, setCategory] = useState<SonggardenCategoryId>("ambient");
  const [label, setLabel] = useState("");
  const [name, setName] = useState(() => getSonggardenContributorName(eventId) ?? "");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadConsentAgreed, setUploadConsentAgreed] = useState(false);

  const selectedCategory = SONGGARDEN_CATEGORIES.find((c) => c.id === category);

  const resetForm = useCallback(() => {
    setAudioBlob(null);
    setLabel("");
    setSuccess(null);
    setUploadConsentAgreed(false);
  }, []);

  async function prepareWavBlob(source: Blob): Promise<{ blob: Blob; durationMs: number | null }> {
    const wav = await blobToWavBlob(source);
    const durationMs = await new Promise<number | null>((resolve) => {
      const url = URL.createObjectURL(wav);
      const audio = new Audio(url);
      audio.addEventListener("loadedmetadata", () => {
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : null);
      });
      audio.addEventListener("error", () => {
        URL.revokeObjectURL(url);
        resolve(null);
      });
    });
    return { blob: wav, durationMs };
  }

  async function handleSubmit() {
    if (!audioBlob) {
      setError("Add a sound first — record or upload.");
      return;
    }
    if (mode === "upload" && !uploadConsentAgreed) {
      setError("Please confirm you have permission to share this recording.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      if (name.trim()) setSonggardenContributorName(eventId, name.trim());
      const { blob, durationMs } = await prepareWavBlob(audioBlob);
      const filename = sanitizeSoundFilename(label || name || "sound", "wav");
      await submitSonggardenClip({
        eventId,
        category,
        audio: blob,
        filename,
        contributorName: name.trim() || null,
        label: label.trim() || null,
        durationMs,
      });
      setSuccess("In the Song Garden — the team can hear it now.");
      resetForm();
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function ingestFile(file: File) {
    if (!file.type.startsWith("audio/") && !/\.(mp3|wav|m4a|aac|ogg|webm|flac)$/i.test(file.name)) {
      setError("Please choose an audio file.");
      return;
    }
    setError(null);
    setAudioBlob(file);
  }

  function selectMode(next: InputMode) {
    if (next === mode) return;
    setMode(next);
    setAudioBlob(null);
    setError(null);
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-8 font-mono">
      <div className="flex border border-white/15">
        {(["record", "upload"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => selectMode(tab)}
            className={`flex-1 px-4 py-3 text-sm tracking-wide transition ${
              mode === tab
                ? "bg-white/10 text-[var(--crowdsource-accent)]"
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            {tab === "record" ? "Record" : "Upload"}
          </button>
        ))}
      </div>

      {mode === "upload" && (
        <div className="space-y-4">
          <UploadConsentCheckbox
            checked={uploadConsentAgreed}
            onChange={(checked) => {
              setUploadConsentAgreed(checked);
              if (checked) setError(null);
            }}
          />
          <FileDropZone
            accept="audio/*"
            disabled={!uploadConsentAgreed || submitting}
            onFiles={(files) => {
              const file = files[0];
              if (file) void ingestFile(file);
            }}
            label={
              uploadConsentAgreed
                ? "Drop an audio file here, or click to browse"
                : "Confirm permission above to upload"
            }
            hint="MP3, WAV, M4A, and other audio formats"
            variant="panel"
            className="!border-white/20 !bg-white/5 hover:!border-white/35 hover:!bg-white/10"
          />
          {audioBlob ? (
            <p className="text-center text-xs text-[var(--crowdsource-accent)]">
              File ready — add a label below and drop it in.
            </p>
          ) : null}
        </div>
      )}

      {mode === "record" && (
        <RecordAudio
          variant="plain"
          onRecordingReady={(blob) => {
            setError(null);
            setAudioBlob(blob);
          }}
          onClear={() => setAudioBlob(null)}
        />
      )}

      <section>
        <p className="mb-3 text-xs tracking-wide text-gray-300">What kind of sound?</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SONGGARDEN_CATEGORIES.map((cat) => {
            const selected = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`border px-3 py-2.5 text-left transition ${
                  selected
                    ? "border-[var(--crowdsource-accent)] bg-white/10"
                    : "border-white/20 bg-white/5 hover:border-white/35"
                }`}
              >
                <span
                  className={`block text-sm ${selected ? "text-[var(--crowdsource-accent)]" : "text-gray-100"}`}
                >
                  {cat.label}
                </span>
                <span className={`mt-1 block text-xs leading-snug ${selected ? "text-gray-200" : "text-gray-400"}`}>
                  {cat.hint}
                </span>
              </button>
            );
          })}
        </div>
        {selectedCategory && (
          <p className="mt-4 text-sm leading-relaxed text-gray-200">{selectedCategory.direction}</p>
        )}
      </section>

      {audioBlob && (
        <section className="space-y-6 border-t border-white/10 pt-6">
          <p className="text-center text-sm text-[var(--crowdsource-accent)]">Sound ready</p>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs text-gray-300">Name · optional</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Anonymous"
                className={fieldClass}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs text-gray-300">What is it?</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={selectedCategory?.example ?? "Describe your sound"}
                className={fieldClass}
              />
            </label>
          </div>

          <button
            type="button"
            disabled={submitting || (mode === "upload" && !uploadConsentAgreed)}
            onClick={() => void handleSubmit()}
            className="flex min-h-[52px] w-full items-center justify-center border border-[var(--crowdsource-accent)] px-6 py-3 text-sm tracking-wide text-[var(--crowdsource-accent)] transition hover:bg-[var(--crowdsource-accent)] hover:text-[#1a1530] disabled:opacity-50"
          >
            {submitting ? "Dropping…" : "Drop into Song Garden"}
          </button>
        </section>
      )}

      {error && <p className="text-center text-sm text-red-300">{error}</p>}
      {success && <p className="text-center text-sm text-[var(--crowdsource-accent)]">{success}</p>}
    </div>
  );
}
