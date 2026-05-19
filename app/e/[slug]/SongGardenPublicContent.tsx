"use client";

import { useMemo, useState } from "react";
import { Bebas_Neue } from "next/font/google";
import type { Event } from "@/data/mockEvents";
import RecordAudio from "@/components/RecordAudio";
import { formatDateLong } from "@/lib/formatDate";
import { DEFAULT_SONG_GARDEN_CONFIG, songGardenConfigFromBrief, type SongGardenPrompt } from "@/data/songGarden";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
});

type Props = {
  event: Event;
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function playGuideTone(prompt: SongGardenPrompt) {
  if (!prompt.guideToneHz) return;
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;
  const ctx = new AudioContextCtor();
  if (ctx.state === "suspended") await ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const duration = 2.2;
  osc.frequency.value = prompt.guideToneHz;
  osc.type = "sine";
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.38, ctx.currentTime + 0.04);
  gain.gain.setValueAtTime(0.38, ctx.currentTime + duration - 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
  await new Promise<void>((resolve) => {
    osc.onended = () => {
      void ctx.close().catch(() => undefined);
      resolve();
    };
  });
}

export default function SongGardenPublicContent({ event }: Props) {
  const config = songGardenConfigFromBrief(event.agentBrief) ?? DEFAULT_SONG_GARDEN_CONFIG;
  const [participantName, setParticipantName] = useState("");
  const [consentStatus, setConsentStatus] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [textResponse, setTextResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activePromptIndex, setActivePromptIndex] = useState(0);
  const [guideTonePlaying, setGuideTonePlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePrompt = useMemo(
    () => config.prompts[Math.min(activePromptIndex, Math.max(0, config.prompts.length - 1))],
    [activePromptIndex, config.prompts]
  );
  const totalPrompts = config.prompts.length;

  async function submitContribution() {
    if (!activePrompt || submitting) return;
    setError(null);
    if (!consentStatus) {
      setError("Please check the consent box before submitting.");
      return;
    }
    if (activePrompt.allowAudio && !audioBlob && !textResponse.trim()) {
      setError("Record your sound before submitting.");
      return;
    }
    if (!activePrompt.allowAudio && activePrompt.allowText && !textResponse.trim()) {
      setError("Add your lyric seed before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const audioDataUrl = audioBlob ? await blobToDataUrl(audioBlob) : null;
      const res = await fetch("/api/song-garden/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          eventSlug: event.slug,
          participantName,
          promptId: activePrompt.id,
          promptTitle: activePrompt.title,
          soundType: activePrompt.soundType,
          assetCategory: activePrompt.assetCategory,
          pitch: activePrompt.pitch ?? null,
          midiNote: activePrompt.midiNote ?? null,
          consentStatus,
          textResponse: textResponse.trim() || null,
          audioDataUrl,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error || "Submit failed");
      setAudioBlob(null);
      setTextResponse("");
      if (activePromptIndex < totalPrompts - 1) {
        setActivePromptIndex((index) => index + 1);
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden text-gray-100 pb-[env(safe-area-inset-bottom)]"
      style={{ ["--crowdsource-accent" as string]: "#CFFF81" }}
    >
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/public-bg.png')" }} aria-hidden />
      <div className="absolute inset-0 bg-black/30" aria-hidden />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-10">
        <a href="https://crowdsourcechoir.com" target="_blank" rel="noopener noreferrer" className="mx-auto mb-8 block w-fit opacity-95">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Crowdsource Choir" className="h-14 w-auto sm:h-20" />
        </a>

        <div className="mx-auto w-full max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-[var(--crowdsource-accent)]/80">Song Garden</p>
          <h1 className={`${bebasNeue.className} mt-2 text-5xl leading-none tracking-wide text-[var(--crowdsource-accent)] sm:text-6xl`}>
            {event.title}
          </h1>
          <p className="mt-2 font-mono text-sm text-gray-200 sm:text-base">
            <span className="text-[var(--crowdsource-accent)]">{formatDateLong(event.date)} · </span>
            <span>{event.venue}</span>
          </p>
          <p className="mx-auto mt-5 max-w-xl font-mono text-base leading-relaxed text-gray-200">
            {event.landingHeadline || "Add your voice to the Song Garden."}
          </p>
          {event.landingCopy ? <p className="mx-auto mt-2 max-w-xl text-sm text-gray-300">{event.landingCopy}</p> : null}
        </div>

        <div className="mx-auto mt-8 w-full max-w-xl">
          {submitted ? (
            <section className="rounded-none border border-[var(--crowdsource-accent)]/30 bg-black/35 px-5 py-10 text-center shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:px-8">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--crowdsource-accent)]/75">Received</p>
              <h2 className="mt-4 text-3xl font-semibold text-white">Thank you.</h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-gray-300">
                Your sounds have been planted in this Song Garden. You&apos;re done.
              </p>
            </section>
          ) : activePrompt ? (
            <section className="rounded-none border border-[var(--crowdsource-accent)]/25 bg-black/35 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:p-7">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--crowdsource-accent)]/70">
                Sound {activePromptIndex + 1} of {totalPrompts}
              </p>
              <h2 className="mt-4 text-2xl font-semibold leading-snug text-white sm:text-3xl">
                {activePrompt.instruction}
              </h2>

              <div className="mt-6 space-y-4">
                <input
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="min-h-[48px] w-full rounded-none border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm text-white placeholder-gray-400 focus:border-[var(--crowdsource-accent)] focus:outline-none"
                />

                {activePrompt.guideToneHz ? (
                  <button
                    type="button"
                    disabled={guideTonePlaying}
                    onClick={async () => {
                      setError(null);
                      setGuideTonePlaying(true);
                      try {
                        await playGuideTone(activePrompt);
                      } catch {
                        setError("Could not play the tone. Turn up your volume and try again.");
                      } finally {
                        setGuideTonePlaying(false);
                      }
                    }}
                    className="min-h-[48px] w-full border border-[var(--crowdsource-accent)]/45 px-4 py-3 font-mono text-sm font-semibold text-[var(--crowdsource-accent)] transition hover:bg-[var(--crowdsource-accent)]/10"
                  >
                    {guideTonePlaying ? "Playing..." : "Play the tone"}
                  </button>
                ) : null}

                {activePrompt.allowAudio ? (
                  <RecordAudio
                    key={activePrompt.id}
                    maxSeconds={activePrompt.maxSeconds}
                    countdownSeconds={3}
                    idleLabel="Record"
                    helperLabel={`(up to ${activePrompt.maxSeconds}s)`}
                    onRecordingReady={setAudioBlob}
                    onClear={() => setAudioBlob(null)}
                  />
                ) : null}

                {activePrompt.allowText ? (
                  <textarea
                    value={textResponse}
                    onChange={(e) => setTextResponse(e.target.value)}
                    rows={3}
                    placeholder={activePrompt.allowAudio ? "Optional note" : "Write your line..."}
                    className="w-full rounded-none border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm text-white placeholder-gray-400 focus:border-[var(--crowdsource-accent)] focus:outline-none"
                  />
                ) : null}

                <label className="flex gap-3 rounded-none border border-white/10 bg-black/20 p-3 text-left text-xs leading-relaxed text-gray-300">
                  <input
                    type="checkbox"
                    checked={consentStatus}
                    onChange={(e) => setConsentStatus(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#CFFF81]"
                  />
                  <span>{config.consentCopy}</span>
                </label>

                {error ? <p className="rounded border border-red-400/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p> : null}

                <button
                  type="button"
                  disabled={submitting}
                  onClick={submitContribution}
                  className="min-h-[56px] w-full border border-[var(--crowdsource-accent)] bg-transparent px-6 py-3 font-mono text-base font-medium tracking-wide text-[var(--crowdsource-accent)] transition hover:bg-[#CFFF81] hover:text-[#1a1530] disabled:opacity-50"
                >
                  {submitting ? "Sending..." : "Send"}
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
