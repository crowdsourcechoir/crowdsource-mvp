"use client";

import { useState, FormEvent } from "react";
import type { Event } from "@/data/mockEvents";
import { googleMapsSearchUrl } from "@/components/AddressMap";
import RecordAudio from "@/components/RecordAudio";
import RecordVideo from "@/components/RecordVideo";
import { formatDateLong, formatTime } from "@/lib/formatDate";
import { addSubmission } from "@/data/submissionsClient";
import { videoDataUrlToMp4Blob } from "@/lib/videoToMp4";

type PublicEventContentProps = {
  event: Event;
};

/** Show only the question part after a colon (e.g. "Send a voice note: What does winter mean to you?" → "What does winter mean to you?") */
function displayPrompt(prompt: string): string {
  const colon = prompt.indexOf(":");
  if (colon >= 0) {
    const after = prompt.slice(colon + 1).trim();
    return after ? after.charAt(0).toUpperCase() + after.slice(1) : prompt;
  }
  return prompt;
}

export default function PublicEventContent({ event }: PublicEventContentProps) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);

  function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const form = e.currentTarget;
      const name = (form.querySelector('[name="name"]') as HTMLInputElement)?.value?.trim() || null;
      let audioDataUrl: string | null = null;
      let videoDataUrl: string | null = null;
      if (audioBlob) audioDataUrl = await blobToDataUrl(audioBlob);
      if (videoBlob) {
        const rawVideoUrl = await blobToDataUrl(videoBlob);
        if (rawVideoUrl.startsWith("data:video/webm")) {
          try {
            const mp4Blob = await videoDataUrlToMp4Blob(rawVideoUrl);
            videoDataUrl = await blobToDataUrl(mp4Blob);
          } catch {
            videoDataUrl = rawVideoUrl;
          }
        } else {
          videoDataUrl = rawVideoUrl;
        }
      }
      await addSubmission(event.slug, { name, audioDataUrl, videoDataUrl });
      setSubmitted(true);
    } catch (err) {
      console.error("Submit error:", err);
      const isQuota = err instanceof DOMException && err.name === "QuotaExceededError";
      setSubmitError(
        isQuota
          ? "Storage full. Clear site data for this site in your browser settings, then try again."
          : "Submit failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-gray-100 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
        <a
          href="https://crowdsourcechoir.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-8 block w-fit"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Crowdsource Choir" className="h-10 w-auto" />
        </a>

        {/* Single bubble: event reference + question + submit */}
        <div className="overflow-hidden rounded-2xl border border-gray-700/60 bg-[#18181b]">
          {/* Event reference */}
          <div className="border-b border-gray-700/60">
            <div className="relative h-32 w-full bg-gray-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.heroImage}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="px-4 py-3 sm:px-6">
              <h1 className="text-base font-semibold text-white sm:text-lg">{event.title}</h1>
              <p className="mt-0.5 text-sm text-gray-400">
                {formatDateLong(event.date)} · {formatTime(event.time)}
              </p>
              <a
                href={googleMapsSearchUrl(event.venue, event.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-gray-500 hover:text-gray-400 hover:underline"
              >
                {event.venue}
              </a>
              {event.address && (
                <a
                  href={googleMapsSearchUrl(event.venue, event.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 block text-xs text-gray-500 hover:text-gray-400 hover:underline"
                >
                  {event.address}
                </a>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-8">
            <p className="text-center text-xl font-bold leading-tight text-white sm:text-2xl sm:text-3xl">
              {displayPrompt(event.prompt)}
            </p>

            <div className="mt-10 border-t border-gray-700/60 pt-8 text-center">
              <h2 className="text-lg font-semibold text-white">Submit your response</h2>
              <p className="mt-2 text-sm text-gray-400">Choose either audio or video for your response.</p>
              {submitted ? (
                <p className="mt-4 text-green-400">Thank you! Your response has been received.</p>
              ) : (
                <form onSubmit={handleSubmit} className="mx-auto mt-6 max-w-sm space-y-6">
                  {submitError && (
                    <p className="rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-300">
                      {submitError}
                    </p>
                  )}
                  <div className="text-left">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-300">
                      Name
                    </label>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Optional — leave blank to submit anonymously
                    </p>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      className="mt-1 block w-full rounded-xl border-2 border-gray-600 bg-gray-800 px-4 py-3 text-base text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                      placeholder="Your name (optional)"
                    />
                  </div>
                  <RecordAudio
                    onRecordingReady={setAudioBlob}
                    onClear={() => setAudioBlob(null)}
                  />
                  <RecordVideo
                    onRecordingReady={setVideoBlob}
                    onClear={() => setVideoBlob(null)}
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="min-h-[48px] w-full rounded-2xl bg-white px-6 py-3 text-base font-medium text-gray-900 active:bg-gray-200 disabled:opacity-60 disabled:pointer-events-none"
                  >
                    {submitting ? "Submitting…" : "Submit"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
