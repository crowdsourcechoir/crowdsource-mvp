"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getEventById } from "@/data/eventsClient";
import { googleMapsSearchUrl } from "@/components/AddressMap";
import {
  getSubmissionsForEvent,
  updateSubmissionTranscript,
  type StoredSubmission,
} from "@/data/submissionsClient";
import {
  getSongSeedForEvent,
  generateSongSeed,
  type SongSeed,
  type GenerateSongSeedError,
} from "@/data/agentInterview";
import type { SongSeedTranscriptIssue } from "@/types/song-seed";
import type { Event } from "@/data/mockEvents";
import JSZip from "jszip";
import { dataUrlToWavBlob } from "@/lib/audioToWav";
import { videoDataUrlToMp4Blob } from "@/lib/videoToMp4";
import {
  songGardenConfigFromBrief,
  type SongGardenSubmission,
  type SongGardenSubmissionStatus,
} from "@/data/songGarden";

type InterviewSubmissionItem = {
  participantName: string;
  conversationId: string;
  answers: Array<{
    createdAt: string;
    content: string;
    audioUrl?: string | null;
    videoUrl?: string | null;
  }>;
};

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
    section1: { prompts: Array<{ detailedStylePrompt: string; alternativeStylePrompt: string; genreBlueprint: string; lyricIdeas?: string }> };
    section2: { keyPhrases: string[] };
  } | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [transcribeAllStatus, setTranscribeAllStatus] = useState<string | null>(null);
  const [summaryScope, setSummaryScope] = useState("");
  const [songSeed, setSongSeed] = useState<SongSeed | null>(null);
  const [loadingSongSeed, setLoadingSongSeed] = useState(false);
  const [songSeedError, setSongSeedError] = useState<string | null>(null);
  const [songSeedErrorIssues, setSongSeedErrorIssues] = useState<SongSeedTranscriptIssue[] | null>(null);
  const [agentInterviewSubmissions, setAgentInterviewSubmissions] = useState<InterviewSubmissionItem[]>([]);
  const [loadingAgentInterviewSubmissions, setLoadingAgentInterviewSubmissions] = useState(false);
  const [songGardenSubmissions, setSongGardenSubmissions] = useState<SongGardenSubmission[]>([]);
  const [loadingSongGardenSubmissions, setLoadingSongGardenSubmissions] = useState(false);
  const [loadingSongGardenExport, setLoadingSongGardenExport] = useState(false);

  useEffect(() => {
    getEventById(eventId)
      .then((e) => {
        if (e) {
          setEvent(e);
          getSubmissionsForEvent(e.slug).then(setSubmissions);
          if (e.agentThemeId) getSongSeedForEvent(e.id).then(setSongSeed).catch(() => setSongSeed(null));
          const songGardenConfig = songGardenConfigFromBrief(e.agentBrief);

          if (songGardenConfig) {
            setLoadingSongGardenSubmissions(true);
            fetch(`/api/song-garden/submissions?eventId=${encodeURIComponent(e.id)}`)
              .then(async (r) => {
                const data = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error((data as any)?.error || "Failed to load Song Garden submissions");
                return data;
              })
              .then((data) => {
                const items = (data as any)?.submissions;
                setSongGardenSubmissions(Array.isArray(items) ? items : []);
              })
              .catch(() => setSongGardenSubmissions([]))
              .finally(() => setLoadingSongGardenSubmissions(false));
          } else {
            setSongGardenSubmissions([]);
          }

          if (e.agentThemeId) {
            setLoadingAgentInterviewSubmissions(true);
            fetch(`/api/agent/interview-submissions?eventId=${encodeURIComponent(e.id)}`)
              .then(async (r) => {
                const data = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error((data as any)?.error || "Failed to load");
                return data;
              })
              .then((data) => {
                const items = (data as any)?.items;
                setAgentInterviewSubmissions(Array.isArray(items) ? items : []);
              })
              .catch(() => setAgentInterviewSubmissions([]))
              .finally(() => setLoadingAgentInterviewSubmissions(false));
          } else {
            setAgentInterviewSubmissions([]);
          }
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [eventId]);

  const agentInterviewCopyText = useMemo(() => {
    if (!agentInterviewSubmissions.length) return "";
    const parts: string[] = [];
    agentInterviewSubmissions.forEach((item) => {
      parts.push(`Participant: ${item.participantName}`);
      item.answers.forEach((a, idx) => {
        parts.push(`- (${idx + 1}) ${a.content}`);
      });
      parts.push("");
    });
    return parts.join("\n").trim();
  }, [agentInterviewSubmissions]);

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
        <p className="mt-2 text-sm text-gray-500">
          With local events (USE_LOCAL_EVENTS=true), events live in the dev server&apos;s memory. If you just created this event, run only one dev server (stop any other terminal running <code className="rounded bg-gray-800 px-1">npm run dev</code>) and try creating again.
        </p>
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

  const songGardenConfig = songGardenConfigFromBrief(event.agentBrief);
  const approvedSongGardenCount = songGardenSubmissions.filter((submission) => submission.status === "approved").length;

  async function updateSongGardenStatus(id: string, status: SongGardenSubmissionStatus) {
    const res = await fetch(`/api/song-garden/submissions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any)?.error || "Could not update submission");
    const updated = (data as any)?.submission as SongGardenSubmission | undefined;
    if (!updated) return;
    setSongGardenSubmissions((prev) => prev.map((submission) => (submission.id === id ? updated : submission)));
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

      {songGardenConfig && (
        <section className="rounded-2xl border border-amber-300/25 bg-[#18181b] p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Song Garden</h2>
              <p className="mt-1 text-sm text-gray-500">
                Review guided voice/sound submissions and export approved performance assets.
              </p>
            </div>
            <button
              type="button"
              disabled={loadingSongGardenExport || approvedSongGardenCount === 0}
              onClick={async () => {
                setLoadingSongGardenExport(true);
                try {
                  const res = await fetch(
                    `/api/song-garden/events/${encodeURIComponent(event.id)}/export?bpm=${encodeURIComponent(songGardenConfig.exportBpm)}`
                  );
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error((data as any)?.error || "Export failed");
                  }
                  const blob = await res.blob();
                  downloadBlob(blob, `${event.slug}_song_garden_assets.zip`);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Export failed");
                } finally {
                  setLoadingSongGardenExport(false);
                }
              }}
              className="rounded-xl bg-amber-200 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-amber-100 disabled:opacity-50"
            >
              {loadingSongGardenExport ? "Exporting..." : "Export Performance Assets"}
            </button>
          </div>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Submissions</p>
              <p className="mt-1 text-2xl font-semibold text-white">{songGardenSubmissions.length}</p>
            </div>
            <div className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Approved</p>
              <p className="mt-1 text-2xl font-semibold text-white">{approvedSongGardenCount}</p>
            </div>
            <div className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Export BPM</p>
              <p className="mt-1 text-2xl font-semibold text-white">{songGardenConfig.exportBpm}</p>
            </div>
          </div>
          {loadingSongGardenSubmissions && <p className="text-gray-500">Loading Song Garden submissions...</p>}
          {!loadingSongGardenSubmissions && songGardenSubmissions.length === 0 && (
            <p className="text-sm text-gray-500">No Song Garden sounds yet.</p>
          )}
          {songGardenSubmissions.length > 0 && (
            <ul className="space-y-4">
              {songGardenSubmissions.map((submission) => (
                <li key={submission.id} className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{submission.promptTitle}</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {submission.participantName ?? "Anonymous"} · {formatDate(submission.createdAt)} ·{" "}
                        {submission.assetCategory.replace(/_/g, " ")}
                        {submission.pitch ? ` · ${submission.pitch}` : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        submission.status === "approved"
                          ? "bg-emerald-900/40 text-emerald-200"
                          : submission.status === "rejected"
                            ? "bg-red-900/40 text-red-200"
                            : "bg-amber-900/40 text-amber-100"
                      }`}
                    >
                      {submission.status.replace("_", " ")}
                    </span>
                  </div>
                  {submission.rawAudioUrl && (
                    <div className="mt-3 max-w-md">
                      <audio src={submission.rawAudioUrl} controls className="h-9 w-full" preload="metadata" />
                    </div>
                  )}
                  {submission.textResponse && (
                    <p className="mt-3 rounded border border-gray-700/60 bg-[#18181b] px-3 py-2 text-sm text-gray-300">
                      {submission.textResponse}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateSongGardenStatus(submission.id, "approved").catch((err) => alert(err.message))}
                      className="rounded border border-emerald-700/60 bg-emerald-950/30 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/30"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSongGardenStatus(submission.id, "rejected").catch((err) => alert(err.message))}
                      className="rounded border border-red-800/60 bg-red-950/30 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-900/30"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSongGardenStatus(submission.id, "needs_review").catch((err) => alert(err.message))}
                      className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-700"
                    >
                      Needs review
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
                      event?.title ? `Event: ${event.title}` : "",
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
                      if (p.lyricIdeas) {
                        lines.push("Lyric ideas from submissions:");
                        lines.push(p.lyricIdeas);
                        lines.push("");
                      }
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
                          {p.lyricIdeas && (
                            <div>
                              <span className="font-medium text-gray-400">Lyric ideas from submissions:</span>
                              <p className="mt-0.5 whitespace-pre-wrap">{p.lyricIdeas}</p>
                            </div>
                          )}
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

      {event.agentThemeId && (
        <section className="rounded-2xl border border-gray-700/60 bg-[#18181b] p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Song Seed (from Agent Interviews)</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={loadingSongSeed}
                onClick={async () => {
                  setLoadingSongSeed(true);
                  setSongSeedError(null);
                  setSongSeedErrorIssues(null);
                  try {
                    const seed = await generateSongSeed(event.id);
                    setSongSeed(seed);
                  } catch (err) {
                    const e = err as GenerateSongSeedError;
                    setSongSeedError(e instanceof Error ? e.message : "Generate failed");
                    setSongSeedErrorIssues(e.issues?.length ? e.issues : null);
                  } finally {
                    setLoadingSongSeed(false);
                  }
                }}
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-50"
              >
                {loadingSongSeed ? "Generating…" : "Generate Song Seed"}
              </button>
            </div>
          </div>
          {songSeedError && (
            <div className="mb-4 rounded-lg border border-red-800/60 bg-red-950/40 p-3 text-sm text-red-200">
              <p className="whitespace-pre-wrap">{songSeedError}</p>
              {songSeedErrorIssues && songSeedErrorIssues.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-red-100/90">
                  {songSeedErrorIssues.map((i, idx) => (
                    <li key={`${i.conversationId}-${i.kind}-${idx}`}>
                      {i.participantLabel} — {i.kind === "video" ? "Video" : "Voice"} (
                      <span className="font-mono text-xs opacity-80">{i.conversationId.slice(0, 8)}…</span>)
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {songSeed && (
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-300">Top themes</h3>
                <div className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4">
                  <p className="whitespace-pre-wrap text-sm text-gray-200">
                    {songSeed.topThemes.join(" · ")}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(songSeed.topThemes.join("\n"))}
                    className="mt-2 text-xs text-amber-400 hover:underline"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-300">Notable lines</h3>
                <div className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4">
                  <ul className="list-inside list-disc space-y-1 text-sm text-gray-200">
                    {songSeed.notableLines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(songSeed.notableLines.join("\n"))}
                    className="mt-2 text-xs text-amber-400 hover:underline"
                  >
                    Copy all
                  </button>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-300">Singable hooks</h3>
                <div className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4">
                  <p className="whitespace-pre-wrap text-sm text-gray-200">
                    {songSeed.singableHooks.join("\n")}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(songSeed.singableHooks.join("\n"))}
                    className="mt-2 text-xs text-amber-400 hover:underline"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-300">Shoutouts</h3>
                <div className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4">
                  <p className="text-sm text-gray-200">{songSeed.shoutouts.join(", ")}</p>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(songSeed.shoutouts.join(", "))}
                    className="mt-2 text-xs text-amber-400 hover:underline"
                  >
                    Copy
                  </button>
                </div>
              </div>
              {songSeed.emotionalToneSummary && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-300">Emotional tone</h3>
                  <div className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4">
                    <p className="text-sm text-gray-200">{songSeed.emotionalToneSummary}</p>
                  </div>
                </div>
              )}
              {songSeed.sunoPrompts && songSeed.sunoPrompts.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-300">Suno-ready song prompts</h3>
                  <p className="mb-3 text-xs text-gray-500">
                    Copy any prompt below and paste into the Suno song engine. Each is a different angle for this event.
                  </p>
                  <div className="space-y-4">
                    {songSeed.sunoPrompts.map((prompt, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4"
                      >
                        <p className="whitespace-pre-wrap text-sm text-gray-200">{prompt}</p>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(prompt)}
                          className="mt-2 text-xs text-amber-400 hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {!songSeed && !loadingSongSeed && !songSeedError && (
            <p className="text-sm text-gray-500">
              Generate a Song Seed from agent interview transcripts. Participants must have completed interviews first.
            </p>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-gray-700/60 bg-[#18181b] p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-white">Submissions</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Agent interviews are saved on the server and appear under &quot;Agent interviews&quot; below. Older &quot;browser-stored&quot;
              clips are legacy and only exist on the device that recorded them.
            </p>
          </div>
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
        {event.agentThemeId && (
          <div className="mb-8 space-y-4">
            <h3 className="text-sm font-semibold text-gray-300">Agent interviews (server)</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={loadingAgentInterviewSubmissions || !agentInterviewCopyText}
                onClick={() => navigator.clipboard.writeText(agentInterviewCopyText)}
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700 disabled:opacity-50"
              >
                {loadingAgentInterviewSubmissions ? "Preparing…" : "Copy all interview answers"}
              </button>
            </div>
            {loadingAgentInterviewSubmissions && <p className="text-gray-500">Loading interview answers…</p>}
            {!loadingAgentInterviewSubmissions && agentInterviewSubmissions.length === 0 && (
              <p className="text-gray-500">No agent interview answers yet.</p>
            )}
            {agentInterviewSubmissions.length > 0 && (
              <ul className="space-y-6">
                {agentInterviewSubmissions.map((item) => (
                  <li key={item.conversationId} className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-gray-400">{item.participantName}</span>
                      <span className="text-xs text-gray-500">
                        Conversation {item.conversationId.slice(0, 6)}…
                      </span>
                    </div>
                    {item.answers.length === 0 ? (
                      <p className="text-sm text-gray-500">No answers recorded.</p>
                    ) : (
                      <ul className="space-y-2">
                        {item.answers.map((a, idx) => (
                          <li
                            key={`${item.conversationId}_${a.createdAt}_${idx}`}
                            className="rounded border border-gray-700/60 bg-[#18181b] px-3 py-2"
                          >
                            <p className="text-xs text-gray-500">Answer {idx + 1}</p>
                            {a.content?.trim() ? (
                              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-200">{a.content}</p>
                            ) : null}
                            {a.audioUrl ? (
                              <div className="mt-2 max-w-md">
                                <p className="mb-1 text-xs text-gray-500">Audio</p>
                                <audio src={a.audioUrl} controls className="h-9 w-full" preload="metadata" />
                              </div>
                            ) : null}
                            {a.videoUrl ? (
                              <div className="mt-2 max-w-md">
                                <p className="mb-1 text-xs text-gray-500">Video</p>
                                <div className="max-h-48 w-full overflow-hidden rounded border border-gray-700 bg-black">
                                  <video
                                    src={a.videoUrl}
                                    controls
                                    playsInline
                                    muted
                                    className="min-h-[120px] w-full object-contain"
                                  />
                                </div>
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {submissions.length > 0 && (
          <>
            <h3 className="mb-3 text-sm font-semibold text-gray-300">Browser-stored (legacy)</h3>
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
          </>
        )}

        {!event.agentThemeId && submissions.length === 0 && (
          <p className="text-sm text-gray-500">No submissions yet.</p>
        )}
      </section>
    </div>
  );
}
