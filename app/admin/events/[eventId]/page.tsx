"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getEventById } from "@/data/eventsClient";
import { googleMapsSearchUrl } from "@/components/AddressMap";
import {
  getSubmissionsForEvent,
  updateSubmissionTranscript,
  clearSubmissionsForEvent,
  type StoredSubmission,
} from "@/data/submissionsClient";
import {
  getSongSeedForEvent,
  generateSongSeed,
  type SongSeed,
  type GenerateSongSeedError,
} from "@/data/agentInterview";
import { compositionBriefAdminUrl } from "@/data/compositionClient";
import {
  finalizeEventMemory,
  getEventMemory,
  type EventMemoryRecord,
} from "@/data/memoryClient";
import type { SongSeedTranscriptIssue } from "@/types/song-seed";
import type { Event } from "@/data/mockEvents";
import JSZip from "jszip";
import { dataUrlToWavBlob } from "@/lib/audioToWav";
import { videoDataUrlToMp4Blob } from "@/lib/videoToMp4";
import { publicEventPath } from "@/lib/event-slug-aliases";
import {
  isAnonymousPersonName,
  normalizePersonKey,
} from "@/lib/agent-interview-qa";
import {
  fetchClipFile,
  listSonggardenClips,
  type SonggardenClip,
} from "@/data/songgardenClient";
import { songgardenCategoryLabel } from "@/lib/songgarden/categories";
import SoundClipRow from "@/components/songgarden/SoundClipRow";
import {
  buildSoundPackLayout,
  soundPackReadme,
} from "@/lib/songgarden/sound-pack";
import { confirmRareDelete } from "@/lib/confirm-rare-delete";

type InterviewAnswer = {
  createdAt: string;
  content: string;
  questionText?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  audioTranscript?: string | null;
  videoTranscript?: string | null;
};

type InterviewSubmissionItem = {
  participantName: string;
  conversationId: string;
  answers: InterviewAnswer[];
};

type PersonSubmissionCard = {
  key: string;
  displayName: string;
  conversations: InterviewSubmissionItem[];
  clips: SonggardenClip[];
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
            className="rounded-lg bg-[#CFFF81] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
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
  const [loadingSoundPack, setLoadingSoundPack] = useState(false);
  const [soundPackError, setSoundPackError] = useState<string | null>(null);
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
  const [songgardenClips, setSonggardenClips] = useState<SonggardenClip[]>([]);
  const [loadingAgentInterviewSubmissions, setLoadingAgentInterviewSubmissions] = useState(false);
  const [deletingInterviewId, setDeletingInterviewId] = useState<string | null>(null);
  const [wipingAllSubmissions, setWipingAllSubmissions] = useState(false);
  const [deletingBloom, setDeletingBloom] = useState(false);
  /** Only one MIDI pad plays at a time across the submissions list. */
  const [activeSoundPadId, setActiveSoundPadId] = useState<string | null>(null);
  const [memoryRecord, setMemoryRecord] = useState<EventMemoryRecord | null>(null);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);

  useEffect(() => {
    getEventById(eventId)
      .then((e) => {
        if (e) {
          setEvent(e);
          getSubmissionsForEvent(e.slug).then(setSubmissions);
          if (e.agentThemeId) getSongSeedForEvent(e.id).then(setSongSeed).catch(() => setSongSeed(null));
          getEventMemory(e.id).then(setMemoryRecord).catch(() => setMemoryRecord(null));

          // Always load interviews + Song Garden clips so person cards can show both.
          setLoadingAgentInterviewSubmissions(true);
          Promise.all([
            fetch(`/api/agent/interview-submissions?eventId=${encodeURIComponent(e.id)}`)
              .then(async (r) => {
                const data = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error((data as { error?: string }).error || "Failed to load");
                return data;
              })
              .then((data) => {
                const items = (data as { items?: InterviewSubmissionItem[] })?.items;
                setAgentInterviewSubmissions(Array.isArray(items) ? items : []);
              })
              .catch(() => setAgentInterviewSubmissions([])),
            listSonggardenClips(e.id)
              .then(setSonggardenClips)
              .catch(() => setSonggardenClips([])),
          ]).finally(() => setLoadingAgentInterviewSubmissions(false));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [eventId]);

  const personSubmissionCards = useMemo((): PersonSubmissionCard[] => {
    const cards = new Map<string, PersonSubmissionCard>();

    function ensureCard(displayName: string, key: string): PersonSubmissionCard {
      let card = cards.get(key);
      if (!card) {
        card = { key, displayName, conversations: [], clips: [] };
        cards.set(key, card);
      }
      return card;
    }

    for (const item of agentInterviewSubmissions) {
      const anon = isAnonymousPersonName(item.participantName);
      const key = anon
        ? `conversation:${item.conversationId}`
        : `name:${normalizePersonKey(item.participantName)}`;
      const card = ensureCard(item.participantName?.trim() || "Anonymous", key);
      card.conversations.push(item);
    }

    for (const clip of songgardenClips) {
      const anon = isAnonymousPersonName(clip.contributorName);
      const key = anon
        ? `clip:${clip.id}`
        : `name:${normalizePersonKey(clip.contributorName)}`;
      const card = ensureCard(clip.contributorName?.trim() || "Anonymous", key);
      card.clips.push(clip);
    }

    return Array.from(cards.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })
    );
  }, [agentInterviewSubmissions, songgardenClips]);

  const agentInterviewCopyText = useMemo(() => {
    if (!personSubmissionCards.length) return "";
    const parts: string[] = [];
    personSubmissionCards.forEach((card) => {
      parts.push(`Participant: ${card.displayName}`);
      card.conversations.forEach((item) => {
        item.answers.forEach((a, idx) => {
          const q = a.questionText?.trim();
          if (q) parts.push(`Q: ${q}`);
          parts.push(`A${idx + 1}: ${a.content || "(media only)"}`);
          if (a.audioTranscript?.trim()) parts.push(`  Audio transcript: ${a.audioTranscript.trim()}`);
          if (a.videoTranscript?.trim()) parts.push(`  Video transcript: ${a.videoTranscript.trim()}`);
        });
      });
      card.clips.forEach((clip, idx) => {
        const prompt = clip.label?.trim() || songgardenCategoryLabel(clip.category);
        const dur =
          clip.durationMs != null && Number.isFinite(clip.durationMs)
            ? ` ${Math.round(clip.durationMs / 1000)}s`
            : "";
        parts.push(`Sound ${idx + 1}: ${prompt} (${songgardenCategoryLabel(clip.category)}${dur})`);
      });
      parts.push("");
    });
    return parts.join("\n").trim();
  }, [personSubmissionCards]);

  async function handleExportSoundPack() {
    if (!event || songgardenClips.length === 0) return;
    setLoadingSoundPack(true);
    setSoundPackError(null);
    try {
      const { entries, manifest } = buildSoundPackLayout({
        eventId: event.id,
        eventSlug: event.slug,
        clips: songgardenClips,
      });

      // Fetch each unique clip once, then write into both folder trees.
      const fileByClipId = new Map<string, File>();
      const uniqueClips = Array.from(new Map(songgardenClips.map((c) => [c.id, c])).values());
      for (const clip of uniqueClips) {
        const file = await fetchClipFile(event.id, clip);
        fileByClipId.set(clip.id, file);
      }

      const zip = new JSZip();
      const root = `${event.slug}_sound-pack`;
      zip.file(`${root}/README.txt`, soundPackReadme(event.slug, songgardenClips.length, manifest.kitClipCount));
      zip.file(`${root}/manifest.json`, JSON.stringify(manifest, null, 2));

      for (const entry of entries) {
        const file = fileByClipId.get(entry.clip.id);
        if (!file) continue;
        zip.file(`${root}/${entry.path}`, file);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `${event.slug}_sound-pack.zip`);
    } catch (err) {
      setSoundPackError(err instanceof Error ? err.message : "Could not build sound pack.");
    } finally {
      setLoadingSoundPack(false);
    }
  }

  async function handleDeleteInterviewSubmission(
    conversationId: string,
    participantName: string,
    opts?: { skipConfirm?: boolean }
  ) {
    const label = participantName?.trim() || "this submission";
    if (
      !opts?.skipConfirm &&
      !window.confirm(`Delete ${label}'s interview answers? This cannot be undone.`)
    ) {
      return false;
    }
    setDeletingInterviewId(conversationId);
    try {
      const res = await fetch(`/api/agent/conversations/${encodeURIComponent(conversationId)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Delete failed");
      }
      setAgentInterviewSubmissions((prev) =>
        prev.filter((item) => item.conversationId !== conversationId)
      );
      return true;
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete submission.");
      return false;
    } finally {
      setDeletingInterviewId(null);
    }
  }

  async function handleDeletePersonInterviews(card: PersonSubmissionCard) {
    if (card.conversations.length === 0) return;
    const label = card.displayName?.trim() || "this person";
    if (
      !window.confirm(
        `Delete ${label}'s interview answer${card.conversations.length > 1 ? "s" : ""}? Song Garden sounds on this card are kept. This cannot be undone.`
      )
    ) {
      return;
    }
    for (const conv of card.conversations) {
      const ok = await handleDeleteInterviewSubmission(conv.conversationId, card.displayName, {
        skipConfirm: true,
      });
      if (!ok) break;
    }
  }

  async function handleWipeAllTestData() {
    if (!event) return;
    if (
      !window.confirm(
        "Wipe ALL test submissions for this event?\n\nThis removes:\n• Agent interview answers\n• Song Garden audio clips\n• Song seeds\n• Memory archive\n• Linked live game sessions\n\nBrowser-stored clips on this device are cleared too.\n\nThe event itself is kept. This cannot be undone."
      )
    ) {
      return;
    }
    setWipingAllSubmissions(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.id)}/submissions`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Wipe failed");
      }
      await clearSubmissionsForEvent(event.slug);
      setSubmissions([]);
      setAgentInterviewSubmissions([]);
      setSonggardenClips([]);
      setSongSeed(null);
      setMemoryRecord(null);
      setTranscriptOutput(null);
      setTranscriptError(null);
      setSongSeedError(null);
      setMemoryError(null);
      const deleted = (data as { deleted?: Record<string, number> }).deleted;
      const summary = deleted
        ? `Removed ${deleted.agentInterviews ?? 0} interview(s), ${deleted.songgardenClips ?? 0} Song Garden clip(s), ${deleted.songSeeds ?? 0} song seed(s), ${deleted.memoryRecords ?? 0} memory record(s), ${deleted.liveSessions ?? 0} live session(s).`
        : "All server submissions cleared.";
      window.alert(`Test data wiped.\n\n${summary}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not wipe submissions.");
    } finally {
      setWipingAllSubmissions(false);
    }
  }

  async function handleDeleteBloom() {
    if (!event || deletingBloom) return;
    if (!confirmRareDelete("bloom", event.title)) return;
    setDeletingBloom(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Delete failed");
      }
      router.push("/admin/events");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete bloom.");
      setDeletingBloom(false);
    }
  }

  if (!loaded) {
    return (
      <div className="w-full px-4 py-12">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="w-full rounded-xl border border-gray-700 bg-transparent p-6">
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

  return (
    <div className="w-full space-y-10">
      {/* Public-style event card */}
      <div className="overflow-hidden rounded-2xl border border-gray-700/60 bg-transparent">
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
              className="rounded-lg bg-[#CFFF81] px-4 py-2 text-sm font-semibold text-black hover:bg-[#bdf25e]"
            >
              Edit event
            </Link>
            <Link
              href={publicEventPath(event.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[#CFFF81]/40 bg-[#CFFF81]/10 px-4 py-3 text-sm font-medium text-[#CFFF81] hover:bg-[#CFFF81]/20"
            >
              Open public link
            </Link>
            <Link
              href={`/admin/songgarden/${event.id}`}
              className="rounded-lg border border-gray-600 bg-transparent px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 active:bg-gray-700"
            >
              Composition canvas
            </Link>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-red-900/50 bg-transparent p-6">
        <h2 className="text-lg font-semibold text-red-200">Delete bloom</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Rare. Removes this bloom and its interviews, clips, and submissions. You will be asked twice.
        </p>
        <button
          type="button"
          disabled={deletingBloom}
          onClick={() => void handleDeleteBloom()}
          className="mt-4 rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-900/40 disabled:opacity-50"
        >
          {deletingBloom ? "Deleting…" : "Delete bloom"}
        </button>
      </section>

      {(transcriptOutput || transcriptError) && (
        <section className="rounded-2xl border border-gray-700/60 bg-transparent p-6">
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
        <section className="rounded-2xl border border-gray-700/60 bg-transparent p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Song Seed (from Agent Interviews)</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={compositionBriefAdminUrl({ eventId: event.id })}
                className="rounded-xl border border-violet-700/60 bg-violet-950/40 px-4 py-2 text-sm font-medium text-violet-100 hover:bg-violet-900/40"
              >
                Composition Brief →
              </Link>
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
                className="rounded-lg bg-[#CFFF81] px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
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

      <section className="rounded-2xl border border-emerald-900/40 bg-transparent p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Memory Archive</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Layer 4 — consent-scoped snapshot of this event for future shows. Finalize when the live
              experience is complete.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {memoryRecord && (
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(memoryRecord, null, 2)], {
                    type: "application/json",
                  });
                  downloadBlob(blob, `memory-${event.slug}-v${memoryRecord.version}.json`);
                }}
                className="rounded-xl border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700"
              >
                Export JSON
              </button>
            )}
            <button
              type="button"
              disabled={loadingMemory}
              onClick={async () => {
                setLoadingMemory(true);
                setMemoryError(null);
                try {
                  const record = await finalizeEventMemory(event.id);
                  setMemoryRecord(record);
                } catch (err) {
                  setMemoryError(err instanceof Error ? err.message : "Finalize failed");
                } finally {
                  setLoadingMemory(false);
                }
              }}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {loadingMemory
                ? "Archiving…"
                : memoryRecord
                  ? "Regenerate archive"
                  : "Finalize archive"}
            </button>
          </div>
        </div>

        {memoryError && (
          <div className="mb-4 rounded-lg border border-red-800/60 bg-red-950/40 p-3 text-sm text-red-200">
            {memoryError}
          </div>
        )}

        {memoryRecord ? (
          <div className="space-y-6">
            <p className="text-xs text-gray-500">
              Version {memoryRecord.version} · Finalized {formatDate(memoryRecord.finalizedAt)}
            </p>

            {memoryRecord.emotionalProfile.summary && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-300">Emotional summary</h3>
                <p className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4 text-sm text-gray-200">
                  {memoryRecord.emotionalProfile.summary}
                </p>
              </div>
            )}

            {memoryRecord.emotionalProfile.themes.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-300">Themes</h3>
                <p className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4 text-sm text-gray-200">
                  {memoryRecord.emotionalProfile.themes.join(" · ")}
                </p>
              </div>
            )}

            {memoryRecord.anthemFragments.hooks.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-300">Hook candidates (reusable)</h3>
                <ul className="list-inside list-disc space-y-1 rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4 text-sm text-gray-200">
                  {memoryRecord.anthemFragments.hooks.map((line, i) => (
                    <li key={i}>
                      &quot;{line.text}&quot;
                      <span className="ml-2 text-xs text-gray-500">({line.tier})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {memoryRecord.anthemFragments.chantableLines.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-300">Chantable lines</h3>
                <ul className="list-inside list-disc space-y-1 rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4 text-sm text-gray-200">
                  {memoryRecord.anthemFragments.chantableLines.map((line, i) => (
                    <li key={i}>&quot;{line.text}&quot;</li>
                  ))}
                </ul>
              </div>
            )}

            {memoryRecord.signalProfile.resolutions.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-300">Signal profile</h3>
                <ul className="space-y-1 rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4 text-sm text-gray-200">
                  {memoryRecord.signalProfile.resolutions.map((r) => (
                    <li key={r.roundId}>
                      {r.layer}: <span className="text-emerald-300/90">{r.label}</span>
                      <span className="text-gray-500"> ({r.voteCount} votes)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {memoryRecord.compositionArtifacts.sunoPrompts.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-300">Suno prompts</h3>
                <div className="space-y-3">
                  {memoryRecord.compositionArtifacts.sunoPrompts.map((prompt, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] p-4 text-sm text-gray-200"
                    >
                      <p className="whitespace-pre-wrap">{prompt}</p>
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

            <div className="rounded-lg border border-gray-700/40 bg-[#1a1a1a] p-4 text-xs text-gray-500">
              <p>
                Reusable export: {memoryRecord.reusableExport.length} lines · Internal transcript refs:{" "}
                {memoryRecord.voiceSamples.transcriptRefs.length} · Media refs (internal only):{" "}
                {memoryRecord.voiceSamples.mediaRefs.length}
              </p>
              <p className="mt-1">
                Sources — interviews: {memoryRecord.sourceCounts.interviewTurns}, live:{" "}
                {memoryRecord.sourceCounts.liveSubmissions}, signal rounds:{" "}
                {memoryRecord.sourceCounts.signalRounds}
              </p>
            </div>
          </div>
        ) : (
          !loadingMemory &&
          !memoryError && (
            <p className="text-sm text-gray-500">
              No archive yet. Finalize after interviews, live sessions, or composition work is complete.
            </p>
          )
        )}
      </section>

      <section className="rounded-2xl border border-gray-700/60 bg-transparent p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-white">Submissions</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Agent interviews are saved on the server and appear under &quot;Agent interviews&quot; below. Older &quot;browser-stored&quot;
              clips are legacy and only exist on the device that recorded them.
            </p>
            <button
              type="button"
              disabled={wipingAllSubmissions}
              onClick={() => void handleWipeAllTestData()}
              className="mt-3 rounded-lg border border-red-800/60 bg-red-950/30 px-3 py-2 text-sm font-medium text-red-200 hover:bg-red-900/40 disabled:opacity-50"
            >
              {wipingAllSubmissions ? "Wiping…" : "Wipe all test submissions"}
            </button>
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
              className="rounded-lg bg-[#CFFF81] px-3 py-2 text-sm font-semibold text-black hover:bg-[#bdf25e] disabled:opacity-50"
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
        <div className="mb-8 space-y-4">
            <h3 className="text-sm font-semibold text-gray-300">Participant submissions</h3>
            <p className="text-xs text-gray-500">
              One card per person — questions on the left, MIDI-pad sounds on the right (click to
              play, drag into Ableton / Finder).
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={loadingAgentInterviewSubmissions || !agentInterviewCopyText}
                onClick={() => navigator.clipboard.writeText(agentInterviewCopyText)}
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700 disabled:opacity-50"
              >
                {loadingAgentInterviewSubmissions ? "Preparing…" : "Copy all submissions"}
              </button>
              <button
                type="button"
                disabled={loadingSoundPack || songgardenClips.length === 0}
                onClick={() => void handleExportSoundPack()}
                className="rounded-lg border border-[#CFFF81]/40 bg-[#CFFF81]/10 px-3 py-2 text-sm font-medium text-[#CFFF81] hover:bg-[#CFFF81]/15 disabled:opacity-50"
              >
                {loadingSoundPack
                  ? "Building pack…"
                  : `Download sound pack${songgardenClips.length ? ` (${songgardenClips.length})` : ""}`}
              </button>
            </div>
            {soundPackError ? <p className="text-xs text-rose-400">{soundPackError}</p> : null}
            {loadingAgentInterviewSubmissions && <p className="text-gray-500">Loading submissions…</p>}
            {!loadingAgentInterviewSubmissions && personSubmissionCards.length === 0 && (
              <p className="text-gray-500">No interview answers or Song Garden sounds yet.</p>
            )}
            {personSubmissionCards.length > 0 && (
              <ul className="space-y-4">
                {personSubmissionCards.map((card) => {
                  const answerCount = card.conversations.reduce((n, c) => n + c.answers.length, 0);
                  const deletingThis = card.conversations.some(
                    (c) => deletingInterviewId === c.conversationId
                  );
                  const answers = card.conversations.flatMap((item) =>
                    item.answers.map((a, idx) => ({
                      ...a,
                      key: `${item.conversationId}_${a.createdAt}_${idx}`,
                      fallbackLabel: `Answer ${idx + 1}`,
                      sessionHint:
                        card.conversations.length > 1
                          ? item.conversationId.slice(0, 6)
                          : null,
                    }))
                  );

                  return (
                    <li
                      key={card.key}
                      className="rounded-lg border border-gray-700/60 bg-[#1a1a1e] p-3 sm:p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-sm font-medium text-gray-100">{card.displayName}</span>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {answerCount} answer{answerCount === 1 ? "" : "s"}
                            {card.clips.length
                              ? ` · ${card.clips.length} sound${card.clips.length === 1 ? "" : "s"}`
                              : ""}
                            {card.conversations.length > 1
                              ? ` · ${card.conversations.length} sessions`
                              : ""}
                          </p>
                        </div>
                        {card.conversations.length > 0 ? (
                          <button
                            type="button"
                            disabled={deletingThis}
                            onClick={() => void handleDeletePersonInterviews(card)}
                            className="rounded-lg border border-red-800/60 bg-red-950/30 px-2.5 py-1 text-xs font-medium text-red-200 hover:bg-red-900/40 disabled:opacity-50"
                          >
                            {deletingThis ? "Deleting…" : "Delete interview"}
                          </button>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {answers.length > 0 || card.conversations.length > 0 ? (
                          <div className="min-w-0">
                            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                              Answers
                            </p>
                            {answers.length === 0 ? (
                              <p className="text-sm text-gray-500">No interview answers recorded.</p>
                            ) : (
                              <ul className="divide-y divide-gray-800/80 rounded-md border border-gray-800 bg-transparent">
                                {answers.map((a) => (
                                  <li key={a.key} className="px-3 py-2">
                                    <p className="text-[11px] leading-snug text-gray-500">
                                      {a.questionText?.trim() || a.fallbackLabel}
                                      {a.sessionHint ? (
                                        <span className="text-gray-600"> · {a.sessionHint}…</span>
                                      ) : null}
                                    </p>
                                    {a.content?.trim() ? (
                                      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-snug text-gray-200">
                                        {a.content}
                                      </p>
                                    ) : (
                                      <p className="mt-0.5 text-sm italic text-gray-600">
                                        (media only)
                                      </p>
                                    )}
                                    {a.audioUrl ? (
                                      <audio
                                        src={a.audioUrl}
                                        controls
                                        className="mt-1.5 h-8 max-w-full"
                                        preload="metadata"
                                      />
                                    ) : null}
                                    {a.videoUrl ? (
                                      <div className="mt-1.5 max-h-36 max-w-xs overflow-hidden rounded border border-gray-800 bg-black">
                                        <video
                                          src={a.videoUrl}
                                          controls
                                          playsInline
                                          muted
                                          className="max-h-36 w-full object-contain"
                                        />
                                      </div>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ) : null}

                        {card.clips.length > 0 ? (
                          <div className="min-w-0">
                            <div className="mb-1.5 flex items-baseline justify-between gap-2">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                                Sounds
                              </p>
                              <p className="text-[10px] text-gray-600">Play · scrub · drag to DAW</p>
                            </div>
                            <div className="space-y-2">
                              {card.clips.map((clip) => (
                                <SoundClipRow
                                  key={clip.id}
                                  eventId={clip.eventId || event.id}
                                  event={event}
                                  clip={clip}
                                  siblings={card.clips}
                                  activePadId={activeSoundPadId}
                                  onActivate={setActiveSoundPadId}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

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
