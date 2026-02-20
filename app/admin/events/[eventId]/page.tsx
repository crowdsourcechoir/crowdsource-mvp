"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getEventById } from "@/data/eventsClient";
import { googleMapsSearchUrl } from "@/components/AddressMap";
import {
  getSubmissionsForEvent,
  updateSubmissionTranscript,
  type StoredSubmission,
} from "@/data/submissionsClient";
import type { Event } from "@/data/mockEvents";
import JSZip from "jszip";
import { dataUrlToWavBlob } from "@/lib/audioToWav";
import { videoDataUrlToMp4Blob } from "@/lib/videoToMp4";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SubmissionVideoPlayer({ dataUrl }: { dataUrl: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      {!failed ? (
        <video
          src={dataUrl}
          controls
          playsInline
          muted
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black/80 p-4 text-center text-sm text-gray-400">
          <p>This video can&apos;t play in this browser.</p>
          <p className="text-xs">Use &quot;Download video (.mp4)&quot; to watch it.</p>
        </div>
      )}
    </>
  );
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = typeof params?.eventId === "string" ? params.eventId : "";
  const [event, setEvent] = useState<Event | null>(null);
  const [submissions, setSubmissions] = useState<StoredSubmission[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [loadingVideoId, setLoadingVideoId] = useState<string | null>(null);
  const [loadingExportAll, setLoadingExportAll] = useState(false);
  const [loadingTranscribeId, setLoadingTranscribeId] = useState<string | null>(null);
  const [summaryScript, setSummaryScript] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [transcribeAllStatus, setTranscribeAllStatus] = useState<string | null>(null);

  useEffect(() => {
    getEventById(eventId)
      .then((e) => {
        if (e) {
          setEvent(e);
          setSubmissions(getSubmissionsForEvent(e.slug));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [eventId]);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-gray-700 bg-[#18181b] p-6">
        <p className="text-gray-400">Event not found.</p>
        <button
          type="button"
          onClick={() => router.push("/admin/events")}
          className="mt-4 text-sm font-medium text-white hover:underline"
        >
          Back to Events
        </button>
      </div>
    );
  }

  /** Show only the question part after a colon, like the public view */
  function displayPrompt(prompt: string): string {
    const colon = prompt.indexOf(":");
    if (colon >= 0) {
      const after = prompt.slice(colon + 1).trim();
      return after ? after.charAt(0).toUpperCase() + after.slice(1) : prompt;
    }
    return prompt;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      {/* Public-style event card */}
      <div className="overflow-hidden rounded-2xl border border-gray-700/60 bg-[#18181b]">
        <div className="border-b border-gray-700/60">
          <div className="relative h-40 w-full bg-gray-900">
            {event.heroImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={event.heroImage}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-600">No hero image</div>
            )}
          </div>
          <div className="px-6 py-4">
            <h1 className="text-xl font-semibold text-white">{event.title}</h1>
            <p className="mt-0.5 text-sm text-gray-400">
              {event.date} · {event.time}
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
        <div className="px-6 py-4">
          <p className="text-sm text-gray-400">
            <span className="font-medium text-gray-500">Prompt:</span>{" "}
            {event.prompt ? displayPrompt(event.prompt) : "—"}
          </p>
          {event.description && (
            <p className="mt-1 text-sm text-gray-400">
              <span className="font-medium text-gray-500">Description:</span>{" "}
              {event.description}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={`/admin/events/${event.id}/edit`}
              className="min-h-[44px] rounded-xl bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-200 active:bg-gray-300"
            >
              Edit event
            </Link>
            <Link
              href={`/e/${event.slug}`}
              className="min-h-[44px] rounded-xl border border-gray-600 bg-transparent px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 active:bg-gray-700"
            >
              View public page
            </Link>
          </div>
        </div>
      </div>

      {summaryScript && (
        <section className="rounded-2xl border border-gray-700/60 bg-[#18181b] p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Summary script</h2>
            <button
              type="button"
              onClick={() => setSummaryScript(null)}
              className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
            >
              Close
            </button>
          </div>
          <div className="whitespace-pre-wrap rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4 text-sm leading-relaxed text-gray-300">
            {summaryScript}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-gray-700/60 bg-[#18181b] p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Submissions</h2>
          {submissions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={
                loadingSummary ||
                !!transcribeAllStatus ||
                submissions.every((s) => !s.audioDataUrl && !s.videoDataUrl)
              }
              onClick={async () => {
                const toTranscribe = submissions.filter(
                  (s) => (s.audioDataUrl || s.videoDataUrl) && !s.transcript
                );
                const total = toTranscribe.length;
                setTranscribeAllStatus(total > 0 ? `Transcribing 0/${total}…` : "Generating summary…");
                try {
                  for (let i = 0; i < toTranscribe.length; i++) {
                    const sub = toTranscribe[i];
                    setTranscribeAllStatus(`Transcribing ${i + 1}/${total}…`);
                    const dataUrl = sub.audioDataUrl || sub.videoDataUrl;
                    if (!dataUrl) continue;
                    try {
                      const res = await fetch("/api/transcribe", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          audioDataUrl: sub.audioDataUrl,
                          videoDataUrl: sub.videoDataUrl,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "Transcription failed");
                      updateSubmissionTranscript(event.slug, sub.id, data.text ?? "");
                    } catch (e) {
                      console.error("Transcribe failed for", sub.id, e);
                    }
                  }
                  setSubmissions(getSubmissionsForEvent(event.slug));
                  setTranscribeAllStatus("Generating summary…");
                  const withTranscripts = getSubmissionsForEvent(event.slug).filter(
                    (s) => s.transcript?.trim()
                  );
                  if (withTranscripts.length === 0) {
                    setSummaryScript("No transcripts available to summarize.");
                    return;
                  }
                  const res = await fetch("/api/summarize", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      transcripts: withTranscripts.map((s) => ({
                        name: s.name,
                        text: s.transcript,
                      })),
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Summary failed");
                  setSummaryScript(data.summary ?? "");
                } catch (e) {
                  console.error(e);
                  setSummaryScript(
                    `Error: ${e instanceof Error ? e.message : "Something went wrong."}`
                  );
                } finally {
                  setTranscribeAllStatus(null);
                }
              }}
              className="rounded-lg border border-white/30 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-50"
            >
              {transcribeAllStatus ?? "Transcribe all & summarize"}
            </button>
            <button
              type="button"
              disabled={loadingSummary || !!transcribeAllStatus || submissions.every((s) => !s.transcript)}
              onClick={async () => {
                const withTranscripts = submissions.filter((s) => s.transcript?.trim());
                if (withTranscripts.length === 0) return;
                setLoadingSummary(true);
                try {
                  const res = await fetch("/api/summarize", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      transcripts: withTranscripts.map((s) => ({
                        name: s.name,
                        text: s.transcript,
                      })),
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Summary failed");
                  setSummaryScript(data.summary ?? "");
                } catch (e) {
                  console.error(e);
                  setSummaryScript(
                    `Error: ${e instanceof Error ? e.message : "Could not generate summary."}`
                  );
                } finally {
                  setLoadingSummary(false);
                }
              }}
              className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50"
            >
              {loadingSummary ? "Generating…" : "Generate summary only"}
            </button>
            <button
              type="button"
              disabled={loadingExportAll}
              onClick={async () => {
                setLoadingExportAll(true);
                try {
                  const zip = new JSZip();
                  for (const sub of submissions) {
                    if (sub.audioDataUrl) {
                      const wav = await dataUrlToWavBlob(sub.audioDataUrl);
                      zip.file(`${sub.id}_audio.wav`, await wav.arrayBuffer());
                    }
                    if (sub.videoDataUrl) {
                      try {
                        const mp4 = await videoDataUrlToMp4Blob(sub.videoDataUrl);
                        zip.file(`${sub.id}_video.mp4`, await mp4.arrayBuffer());
                      } catch (e) {
                        console.warn("Video conversion failed, skipping:", e);
                      }
                    }
                  }
                  const blob = await zip.generateAsync({ type: "blob" });
                  downloadBlob(blob, `${event.slug}_submissions.zip`);
                } finally {
                  setLoadingExportAll(false);
                }
              }}
              className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50"
            >
              {loadingExportAll ? "Preparing…" : "Download All"}
            </button>
            </div>
          )}
        </div>
        {submissions.length === 0 ? (
          <p className="text-gray-500">No submissions yet.</p>
        ) : (
          <ul className="space-y-6">
            {submissions.map((sub) => (
              <li
                key={sub.id}
                className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-gray-400">
                    {sub.name || "Anonymous"} · {formatDate(sub.submittedAt)}
                  </span>
                  <div className="flex gap-2">
                    {sub.audioDataUrl && (
                      <button
                        type="button"
                        disabled={loadingAudioId === sub.id}
                        onClick={async () => {
                          setLoadingAudioId(sub.id);
                          try {
                            const wav = await dataUrlToWavBlob(sub.audioDataUrl!);
                            downloadBlob(wav, `${event.slug}_${sub.id}_audio.wav`);
                          } finally {
                            setLoadingAudioId(null);
                          }
                        }}
                        className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                      >
                        {loadingAudioId === sub.id ? "Preparing…" : "Download audio (.wav)"}
                      </button>
                    )}
                    {sub.videoDataUrl && (
                      <button
                        type="button"
                        disabled={loadingVideoId === sub.id}
                        onClick={async () => {
                          setLoadingVideoId(sub.id);
                          try {
                            const mp4 = await videoDataUrlToMp4Blob(sub.videoDataUrl!);
                            downloadBlob(mp4, `${event.slug}_${sub.id}_video.mp4`);
                          } catch (e) {
                            console.warn("Video conversion failed:", e);
                          } finally {
                            setLoadingVideoId(null);
                          }
                        }}
                        className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                      >
                        {loadingVideoId === sub.id ? "Preparing…" : "Download video (.mp4)"}
                      </button>
                    )}
                    {(sub.audioDataUrl || sub.videoDataUrl) && (
                      <button
                        type="button"
                        disabled={loadingTranscribeId === sub.id || !!sub.transcript}
                        onClick={async () => {
                          const dataUrl = sub.audioDataUrl || sub.videoDataUrl;
                          if (!dataUrl) return;
                          setLoadingTranscribeId(sub.id);
                          try {
                            const res = await fetch("/api/transcribe", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                audioDataUrl: sub.audioDataUrl,
                                videoDataUrl: sub.videoDataUrl,
                              }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || "Transcription failed");
                            const text = data.text ?? "";
                            updateSubmissionTranscript(event.slug, sub.id, text);
                            setSubmissions(getSubmissionsForEvent(event.slug));
                          } catch (e) {
                            console.error(e);
                            alert(e instanceof Error ? e.message : "Transcription failed");
                          } finally {
                            setLoadingTranscribeId(null);
                          }
                        }}
                        className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                      >
                        {loadingTranscribeId === sub.id
                          ? "Transcribing…"
                          : sub.transcript
                            ? "Transcript"
                            : "Transcribe (AI)"}
                      </button>
                    )}
                  </div>
                </div>
                {sub.transcript && (
                  <div className="mb-3 rounded border border-gray-700/60 bg-[#1a1a1a] p-3">
                    <p className="mb-1 text-xs font-medium text-gray-500">Transcript</p>
                    <p className="whitespace-pre-wrap text-sm text-gray-300">{sub.transcript}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-6">
                  {sub.audioDataUrl && (
                    <div className="w-full min-w-0 max-w-md">
                      <p className="mb-1 text-xs text-gray-500">Audio</p>
                      <audio
                        src={sub.audioDataUrl}
                        controls
                        className="h-10 w-full"
                      />
                    </div>
                  )}
                  {sub.videoDataUrl && (
                    <div className="w-full min-w-0 max-w-md">
                      <p className="mb-1 text-xs text-gray-500">Video</p>
                      <div className="aspect-video max-h-48 w-full overflow-hidden rounded border border-gray-700 bg-black">
                        <SubmissionVideoPlayer dataUrl={sub.videoDataUrl} />
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
