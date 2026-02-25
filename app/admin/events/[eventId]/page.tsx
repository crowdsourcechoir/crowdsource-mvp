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
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [convertedSrc, setConvertedSrc] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState(false);

  const src = convertedSrc || dataUrl;
  const isWebM = dataUrl.startsWith("data:video/webm");

  const handleConvertAndPlay = async () => {
    setConvertError(false);
    setConverting(true);
    try {
      const blob = await videoDataUrlToMp4Blob(dataUrl);
      const url = URL.createObjectURL(blob);
      setConvertedSrc(url);
      setFailed(false);
    } catch {
      setConvertError(true);
    } finally {
      setConverting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (convertedSrc) URL.revokeObjectURL(convertedSrc);
    };
  }, [convertedSrc]);

  if (!loaded) {
    return (
      <button
        type="button"
        onClick={() => setLoaded(true)}
        className="flex h-full w-full items-center justify-center bg-gray-900/80 text-sm text-gray-400 hover:bg-gray-800/80 hover:text-gray-300"
      >
        Load video
      </button>
    );
  }

  if (failed && !convertedSrc) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black/80 p-4 text-center text-sm text-gray-400">
        <p>This video can&apos;t play in this browser.</p>
        {isWebM && (
          <button
            type="button"
            onClick={handleConvertAndPlay}
            disabled={converting}
            className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-gray-900 disabled:opacity-50"
          >
            {converting ? "Converting…" : "Convert & play"}
          </button>
        )}
        {convertError && <p className="text-xs text-red-400">Conversion failed. Try &quot;Download video (.mp4)&quot;.</p>}
        {!isWebM && (
          <p className="text-xs">Use &quot;Download video (.mp4)&quot; to watch it.</p>
        )}
      </div>
    );
  }

  return (
    <video
      key={src}
      src={src}
      controls
      playsInline
      muted
      className="h-full w-full object-contain"
      onError={() => setFailed(true)}
    />
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
  const [transcriptOutput, setTranscriptOutput] = useState<{
    section1: { prompts: Array<{ detailedStylePrompt: string; alternativeStylePrompt: string; genreBlueprint: string }> };
    section2: { keyPhrases: string[] };
  } | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [transcribeAllStatus, setTranscribeAllStatus] = useState<string | null>(null);
  const [summaryScope, setSummaryScope] = useState("");

  useEffect(() => {
    getEventById(eventId)
      .then((e) => {
        if (e) {
          setEvent(e);
          getSubmissionsForEvent(e.slug).then(setSubmissions);
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

      {(transcriptOutput || transcriptError) && (
        <section className="rounded-2xl border border-gray-700/60 bg-[#18181b] p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Transcript output</h2>
            <div className="flex flex-wrap items-center gap-2">
              {transcriptOutput && (
                <button
                  type="button"
                  onClick={() => {
                    const lines: string[] = [
                      "TRANSCRIPT OUTPUT",
                      event?.name ? `Event: ${event.name}` : "",
                      `Generated: ${formatDate(new Date().toISOString())}`,
                      "",
                      "--- Section 1 — Lyric prompts (for Suno) ---",
                      "",
                    ];
                    transcriptOutput.section1?.prompts?.forEach((p, i) => {
                      lines.push(`Lyric prompt ${i + 1}`);
                      lines.push("Detailed Style Prompt:");
                      lines.push(p.detailedStylePrompt);
                      lines.push("");
                      lines.push("Alternative Style Prompt:");
                      lines.push(p.alternativeStylePrompt);
                      lines.push("");
                      lines.push("Genre Blueprint (2 sentences):");
                      lines.push(p.genreBlueprint);
                      lines.push("");
                    });
                    lines.push("--- Section 2 — Key phrases (exact from transcripts) ---");
                    lines.push("");
                    transcriptOutput.section2?.keyPhrases?.forEach((phrase) => {
                      lines.push(`• "${phrase}"`);
                    });
                    lines.push("");
                    lines.push("--- Section 3 — Full transcripts ---");
                    lines.push("");
                    submissions
                      .filter((s) => s.transcript)
                      .forEach((s) => {
                        lines.push(`${s.name} · ${formatDate(s.submittedAt)}`);
                        lines.push("");
                        lines.push(s.transcript ?? "");
                        lines.push("");
                        lines.push("---");
                        lines.push("");
                      });
                    const text = lines.join("\n");
                    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                    const slug = event?.slug ?? eventId;
                    const date = new Date().toISOString().slice(0, 10);
                    downloadBlob(blob, `transcript-output-${slug}-${date}.txt`);
                  }}
                  className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
                >
                  Download
                </button>
              )}
            <button
              type="button"
              onClick={() => { setTranscriptOutput(null); setTranscriptError(null); }}
              className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
            >
              Close
            </button>
            </div>
          </div>
          {transcriptError && (
            <div className="mb-4 rounded-lg border border-red-800/60 bg-red-950/40 p-4 text-sm text-red-200">
              {transcriptError}
            </div>
          )}
          {transcriptOutput && (
            <div className="space-y-6">
              {/* Section 1: Lyric prompts */}
              {transcriptOutput.section1?.prompts?.length > 0 && (
                <div>
                  <h3 className="mb-2 text-base font-semibold text-white">Section 1 — Lyric prompts (for Suno)</h3>
                  <div className="space-y-4">
                    {transcriptOutput.section1.prompts.map((p, i) => (
                      <div key={i} className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4">
                        <h4 className="mb-2 text-sm font-medium text-gray-200">Lyric prompt {i + 1}</h4>
                        <div className="space-y-3 text-sm text-gray-300">
                          <div>
                            <span className="font-medium text-gray-400">Detailed Style Prompt:</span>
                            <p className="mt-0.5 whitespace-pre-wrap">{p.detailedStylePrompt}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-400">Alternative Style Prompt:</span>
                            <p className="mt-0.5">{p.alternativeStylePrompt}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-400">Genre Blueprint (2 sentences):</span>
                            <p className="mt-0.5">{p.genreBlueprint}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Section 2: Key phrases */}
              {transcriptOutput.section2?.keyPhrases?.length > 0 && (
                <div>
                  <h3 className="mb-2 text-base font-semibold text-white">Section 2 — Key phrases (exact from transcripts)</h3>
                  <ul className="list-inside list-disc space-y-1 rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4 text-sm text-gray-300">
                    {transcriptOutput.section2.keyPhrases.map((phrase, i) => (
                      <li key={i} className="leading-relaxed">&quot;{phrase}&quot;</li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Section 3: Full transcripts */}
              {submissions.some((s) => s.transcript) && (
                <div>
                  <h3 className="mb-2 text-base font-semibold text-white">Section 3 — Full transcripts</h3>
                  <div className="space-y-4">
                    {submissions
                      .filter((s) => s.transcript)
                      .map((s) => (
                        <div key={s.id} className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4">
                          <p className="mb-2 text-sm font-medium text-gray-200">
                            {s.name} · {formatDate(s.submittedAt)}
                          </p>
                          <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
                            {s.transcript}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-gray-700/60 bg-[#18181b] p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Submissions</h2>
          {submissions.length > 0 && (
            <>
            <div className="mb-3 w-full">
              <label htmlFor="summary-scope" className="mb-1 block text-xs font-medium text-gray-500">
                Lyric / scope (optional)
              </label>
              <textarea
                id="summary-scope"
                value={summaryScope}
                onChange={(e) => setSummaryScope(e.target.value)}
                placeholder="e.g. Focus on hope and community; birthday party vibe"
                rows={2}
                className="w-full resize-y rounded-lg border border-gray-600 bg-[#1f1f1f] px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-gray-500 focus:outline-none"
              />
            </div>
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
                setTranscribeAllStatus(total > 0 ? `Transcribing 0/${total}…` : "Generating lyric prompts…");
                const transcriptBySubId = new Map<string, string>();
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
                      const text = data.text ?? "";
                      await updateSubmissionTranscript(event.slug, sub.id, text);
                      transcriptBySubId.set(sub.id, text);
                    } catch (e) {
                      console.error("Transcribe failed for", sub.id, e);
                    }
                  }
                  setSubmissions((prev) =>
                    prev.map((s) => ({
                      ...s,
                      transcript: transcriptBySubId.get(s.id) ?? s.transcript,
                    }))
                  );
                  setTranscribeAllStatus("Generating lyric prompts…");
                  const withTranscripts = submissions
                    .map((s) => ({
                      name: s.name,
                      text: transcriptBySubId.get(s.id) ?? s.transcript ?? "",
                    }))
                    .filter((x) => x.text.trim());
                  if (withTranscripts.length === 0) {
                    if (toTranscribe.length > 0 && transcriptBySubId.size === 0) {
                      setTranscriptError(
                        "Transcription didn’t run (API key problem?). Add OPENAI_API_KEY in Vercel → Settings → Environment Variables for production, or in .env.local for local dev, then redeploy."
                      );
                      setTranscriptOutput(null);
                    } else {
                      setTranscriptError("No transcripts available to generate from.");
                      setTranscriptOutput(null);
                    }
                    return;
                  }
                  setTranscriptError(null);
                  const res = await fetch("/api/summarize", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      transcripts: withTranscripts,
                      scope: summaryScope.trim() || undefined,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Generate failed");
                  setTranscriptOutput(data);
                } catch (e) {
                  console.error(e);
                  setTranscriptError(
                    `Error: ${e instanceof Error ? e.message : "Something went wrong."}`
                  );
                  setTranscriptOutput(null);
                } finally {
                  setTranscribeAllStatus(null);
                }
              }}
              className="rounded-lg border border-white/30 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-50"
            >
              {transcribeAllStatus ?? "Transcribe all & generate"}
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
            </>
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
                            await updateSubmissionTranscript(event.slug, sub.id, text);
                            setSubmissions((prev) =>
                              prev.map((s) => (s.id === sub.id ? { ...s, transcript: text } : s))
                            );
                          } catch (e) {
                            console.error(e);
                            const msg = e instanceof Error ? e.message : "Transcription failed";
                            const friendly =
                              msg.includes("API key") || msg.includes("401") || msg.includes("OPENAI")
                                ? "Transcription failed: check OPENAI_API_KEY. Use Vercel → Settings → Environment Variables (production) or .env.local (local)."
                                : msg;
                            alert(friendly);
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
                      <div className="max-h-48 w-full overflow-hidden rounded border border-gray-700 bg-black">
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
