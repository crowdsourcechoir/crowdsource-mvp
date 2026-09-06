"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import {
  generateSongSeed,
  getSongSeedForEvent,
  type GenerateSongSeedError,
  type SongSeed,
} from "@/data/agentInterview";
import { compositionBriefAdminUrl } from "@/data/compositionClient";
import { clearSubmissionsForEvent } from "@/data/submissionsClient";
import {
  fetchClipFile,
  listSonggardenClips,
  type SonggardenClip,
} from "@/data/songgardenClient";
import type { Event } from "@/data/mockEvents";
import type { SongSeedTranscriptIssue } from "@/types/song-seed";
import {
  isAnonymousPersonName,
  normalizePersonKey,
  type PairedInterviewAnswer,
} from "@/lib/agent-interview-qa";
import { songgardenCategoryLabel } from "@/lib/songgarden/categories";
import {
  buildSoundPackLayout,
  soundPackReadme,
} from "@/lib/songgarden/sound-pack";
import SoundClipRow from "@/components/songgarden/SoundClipRow";

type InterviewSubmissionItem = {
  participantName: string;
  conversationId: string;
  answers: PairedInterviewAnswer[];
};

type PersonCard = {
  key: string;
  displayName: string;
  conversations: InterviewSubmissionItem[];
  clips: SonggardenClip[];
};

const btnPrimary =
  "rounded-lg bg-[#CFFF81] px-3 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#b8f06a] disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary =
  "rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-[#CFFF81] hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
const copyLink = "mt-2 text-xs font-medium text-[#CFFF81] hover:underline";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = { event: Event };

/** Bloom Song Seed + submissions in Composer. Lime primary / outline secondary only. */
export default function ComposerBloomMaterials({ event }: Props) {
  const [songSeed, setSongSeed] = useState<SongSeed | null>(null);
  const [loadingSongSeed, setLoadingSongSeed] = useState(false);
  const [songSeedError, setSongSeedError] = useState<string | null>(null);
  const [songSeedErrorIssues, setSongSeedErrorIssues] = useState<
    SongSeedTranscriptIssue[] | null
  >(null);

  const [interviews, setInterviews] = useState<InterviewSubmissionItem[]>([]);
  const [clips, setClips] = useState<SonggardenClip[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [wiping, setWiping] = useState(false);
  const [exportingPack, setExportingPack] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [activePadId, setActivePadId] = useState<string | null>(null);

  const loadSubmissions = useCallback(async () => {
    setLoadingSubmissions(true);
    try {
      const [interviewItems, clipList] = await Promise.all([
        fetch(
          `/api/agent/interview-submissions?eventId=${encodeURIComponent(event.id)}`
        )
          .then(async (r) => {
            const data = await r.json().catch(() => ({}));
            if (!r.ok) {
              throw new Error(
                (data as { error?: string }).error || "Failed to load interviews"
              );
            }
            return data;
          })
          .then((data) => {
            const items = (data as { items?: InterviewSubmissionItem[] }).items;
            return Array.isArray(items) ? items : [];
          })
          .catch(() => [] as InterviewSubmissionItem[]),
        listSonggardenClips(event.id).catch(() => [] as SonggardenClip[]),
      ]);
      setInterviews(interviewItems);
      setClips(clipList);
    } finally {
      setLoadingSubmissions(false);
    }
  }, [event.id]);

  useEffect(() => {
    let cancelled = false;
    if (event.agentThemeId) {
      getSongSeedForEvent(event.id)
        .then((seed) => {
          if (!cancelled) setSongSeed(seed);
        })
        .catch(() => {
          if (!cancelled) setSongSeed(null);
        });
    } else {
      setSongSeed(null);
    }
    return () => {
      cancelled = true;
    };
  }, [event.id, event.agentThemeId]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const personCards = useMemo((): PersonCard[] => {
    const cards = new Map<string, PersonCard>();

    function ensure(displayName: string, key: string): PersonCard {
      let card = cards.get(key);
      if (!card) {
        card = { key, displayName, conversations: [], clips: [] };
        cards.set(key, card);
      }
      return card;
    }

    for (const item of interviews) {
      const anon = isAnonymousPersonName(item.participantName);
      const key = anon
        ? `conversation:${item.conversationId}`
        : `name:${normalizePersonKey(item.participantName)}`;
      ensure(item.participantName?.trim() || "Anonymous", key).conversations.push(item);
    }

    for (const clip of clips) {
      const anon = isAnonymousPersonName(clip.contributorName);
      const key = anon
        ? `clip:${clip.id}`
        : `name:${normalizePersonKey(clip.contributorName)}`;
      ensure(clip.contributorName?.trim() || "Anonymous", key).clips.push(clip);
    }

    return Array.from(cards.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })
    );
  }, [interviews, clips]);

  const copyText = useMemo(() => {
    if (!personCards.length) return "";
    const parts: string[] = [];
    for (const card of personCards) {
      parts.push(`Participant: ${card.displayName}`);
      for (const item of card.conversations) {
        item.answers.forEach((a, idx) => {
          const q = a.questionText?.trim();
          if (q) parts.push(`Q: ${q}`);
          parts.push(`A${idx + 1}: ${a.content || "(media only)"}`);
          if (a.audioTranscript?.trim()) {
            parts.push(`  Audio transcript: ${a.audioTranscript.trim()}`);
          }
          if (a.videoTranscript?.trim()) {
            parts.push(`  Video transcript: ${a.videoTranscript.trim()}`);
          }
        });
      }
      card.clips.forEach((clip, idx) => {
        const prompt = clip.label?.trim() || songgardenCategoryLabel(clip.category);
        const dur =
          clip.durationMs != null && Number.isFinite(clip.durationMs)
            ? ` ${Math.round(clip.durationMs / 1000)}s`
            : "";
        parts.push(
          `Sound ${idx + 1}: ${prompt} (${songgardenCategoryLabel(clip.category)}${dur})`
        );
      });
      parts.push("");
    }
    return parts.join("\n").trim();
  }, [personCards]);

  async function handleGenerateSeed() {
    setLoadingSongSeed(true);
    setSongSeedError(null);
    setSongSeedErrorIssues(null);
    try {
      setSongSeed(await generateSongSeed(event.id));
    } catch (err) {
      const e = err as GenerateSongSeedError;
      setSongSeedError(e instanceof Error ? e.message : "Generate failed");
      setSongSeedErrorIssues(e.issues?.length ? e.issues : null);
    } finally {
      setLoadingSongSeed(false);
    }
  }

  async function handleWipe() {
    if (
      !window.confirm(
        "Wipe ALL test submissions for this bloom?\n\nRemoves interviews, Song Garden clips, song seeds, memory archive, and linked live sessions.\n\nThe bloom itself is kept."
      )
    ) {
      return;
    }
    setWiping(true);
    try {
      const res = await fetch(
        `/api/events/${encodeURIComponent(event.id)}/submissions`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Wipe failed");
      }
      await clearSubmissionsForEvent(event.slug);
      setInterviews([]);
      setClips([]);
      setSongSeed(null);
      setSongSeedError(null);
      setPackError(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not wipe submissions.");
    } finally {
      setWiping(false);
    }
  }

  async function handleExportPack() {
    if (clips.length === 0) return;
    setExportingPack(true);
    setPackError(null);
    try {
      const { entries, manifest } = buildSoundPackLayout({
        eventId: event.id,
        eventSlug: event.slug,
        clips,
      });
      const fileByClipId = new Map<string, File>();
      for (const clip of Array.from(new Map(clips.map((c) => [c.id, c])).values())) {
        fileByClipId.set(clip.id, await fetchClipFile(event.id, clip));
      }
      const zip = new JSZip();
      const root = `${event.slug}_sound-pack`;
      zip.file(
        `${root}/README.txt`,
        soundPackReadme(event.slug, clips.length, manifest.kitClipCount)
      );
      zip.file(`${root}/manifest.json`, JSON.stringify(manifest, null, 2));
      for (const entry of entries) {
        const file = fileByClipId.get(entry.clip.id);
        if (file) zip.file(`${root}/${entry.path}`, file);
      }
      downloadBlob(
        await zip.generateAsync({ type: "blob" }),
        `${event.slug}_sound-pack.zip`
      );
    } catch (err) {
      setPackError(err instanceof Error ? err.message : "Could not build sound pack.");
    } finally {
      setExportingPack(false);
    }
  }

  async function handleDeleteConversation(conversationId: string, name: string) {
    const label = name?.trim() || "this submission";
    if (!window.confirm(`Delete ${label}'s interview answers? This cannot be undone.`)) {
      return;
    }
    setDeletingConversationId(conversationId);
    try {
      const res = await fetch(
        `/api/agent/conversations/${encodeURIComponent(conversationId)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Delete failed");
      }
      setInterviews((prev) => prev.filter((i) => i.conversationId !== conversationId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete submission.");
    } finally {
      setDeletingConversationId(null);
    }
  }

  return (
    <div className="space-y-8 border-t border-white/10 pt-6">
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-white">Song Seed</h2>
            <p className="mt-1 text-xs text-gray-500">
              From agent interview transcripts. Participants need completed interviews first.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {event.agentThemeId ? (
              <>
                <Link
                  href={compositionBriefAdminUrl({ eventId: event.id })}
                  className={btnSecondary}
                >
                  Composition Brief
                </Link>
                <button
                  type="button"
                  disabled={loadingSongSeed}
                  onClick={() => void handleGenerateSeed()}
                  className={btnPrimary}
                >
                  {loadingSongSeed ? "Generating…" : "Generate Song Seed"}
                </button>
              </>
            ) : (
              <p className="text-xs text-gray-500">
                Attach an agent theme on the bloom to unlock Song Seed.
              </p>
            )}
          </div>
        </div>

        {songSeedError ? (
          <div className="rounded-lg border border-red-800/60 bg-red-950/40 p-3 text-sm text-red-200">
            <p className="whitespace-pre-wrap">{songSeedError}</p>
            {songSeedErrorIssues?.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-red-100/90">
                {songSeedErrorIssues.map((issue, idx) => (
                  <li key={`${issue.conversationId}-${issue.kind}-${idx}`}>
                    {issue.participantLabel} — {issue.kind === "video" ? "Video" : "Voice"} (
                    <span className="font-mono text-xs opacity-80">
                      {issue.conversationId.slice(0, 8)}…
                    </span>
                    )
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {songSeed ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["Top themes", songSeed.topThemes.join(" · "), songSeed.topThemes.join("\n")],
                [
                  "Notable lines",
                  songSeed.notableLines.map((line) => `• ${line}`).join("\n"),
                  songSeed.notableLines.join("\n"),
                ],
                [
                  "Singable hooks",
                  songSeed.singableHooks.join("\n"),
                  songSeed.singableHooks.join("\n"),
                ],
                [
                  "Shoutouts",
                  songSeed.shoutouts.join(", "),
                  songSeed.shoutouts.join(", "),
                ],
              ] as const
            ).map(([title, body, copy]) => (
              <div key={title} className="rounded-xl border border-white/10 bg-black/40 p-4">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                  {title}
                </h3>
                <p className="whitespace-pre-wrap text-sm text-gray-200">{body || "—"}</p>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(copy)}
                  className={copyLink}
                >
                  Copy
                </button>
              </div>
            ))}
            {songSeed.emotionalToneSummary ? (
              <div className="rounded-xl border border-white/10 bg-black/40 p-4 sm:col-span-2">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                  Emotional tone
                </h3>
                <p className="text-sm text-gray-200">{songSeed.emotionalToneSummary}</p>
              </div>
            ) : null}
            {songSeed.sunoPrompts?.length ? (
              <div className="space-y-3 sm:col-span-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                  Suno-ready prompts
                </h3>
                {songSeed.sunoPrompts.map((prompt, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-black/40 p-4">
                    <p className="whitespace-pre-wrap text-sm text-gray-200">{prompt}</p>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(prompt)}
                      className={copyLink}
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : event.agentThemeId && !loadingSongSeed && !songSeedError ? (
          <p className="text-sm text-gray-500">No seed yet — generate when interviews are ready.</p>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-white">Submissions</h2>
            <p className="mt-1 max-w-2xl text-xs text-gray-500">
              Agent interviews sync from the server. Song Garden clips land with each person.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={wiping}
              onClick={() => void handleWipe()}
              className={btnSecondary}
            >
              {wiping ? "Wiping…" : "Wipe test submissions"}
            </button>
            <button
              type="button"
              disabled={loadingSubmissions || !copyText}
              onClick={() => void navigator.clipboard.writeText(copyText)}
              className={btnSecondary}
            >
              Copy all
            </button>
            <button
              type="button"
              disabled={exportingPack || clips.length === 0}
              onClick={() => void handleExportPack()}
              className={btnPrimary}
            >
              {exportingPack
                ? "Building…"
                : `Download sound pack${clips.length ? ` (${clips.length})` : ""}`}
            </button>
          </div>
        </div>

        {packError ? <p className="text-xs text-rose-400">{packError}</p> : null}
        {loadingSubmissions ? (
          <p className="text-sm text-gray-500">Loading submissions…</p>
        ) : null}
        {!loadingSubmissions && personCards.length === 0 ? (
          <p className="text-sm text-gray-500">No interview answers or Song Garden sounds yet.</p>
        ) : null}

        {personCards.length > 0 ? (
          <ul className="space-y-4">
            {personCards.map((card) => {
              const answerCount = card.conversations.reduce(
                (n, c) => n + c.answers.length,
                0
              );
              const answers = card.conversations.flatMap((item) =>
                item.answers.map((a, idx) => ({
                  ...a,
                  key: `${item.conversationId}_${a.createdAt}_${idx}`,
                }))
              );
              const deleting = card.conversations.some(
                (c) => deletingConversationId === c.conversationId
              );

              return (
                <li
                  key={card.key}
                  className="rounded-xl border border-white/10 bg-black/40 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-white">{card.displayName}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {answerCount} answer{answerCount === 1 ? "" : "s"}
                        {card.clips.length
                          ? ` · ${card.clips.length} sound${card.clips.length === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </div>
                    {card.conversations.length > 0 ? (
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() =>
                          void handleDeleteConversation(
                            card.conversations[0].conversationId,
                            card.displayName
                          )
                        }
                        className={btnSecondary}
                      >
                        {deleting ? "Deleting…" : "Delete interview"}
                      </button>
                    ) : null}
                  </div>

                  {answers.length > 0 ? (
                    <ul className="mb-4 divide-y divide-white/10 rounded-lg border border-white/10">
                      {answers.map((a) => (
                        <li key={a.key} className="px-3 py-2">
                          <p className="text-[11px] text-gray-500">
                            {a.questionText?.trim() || "Answer"}
                          </p>
                          {a.content?.trim() ? (
                            <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-200">
                              {a.content}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-sm italic text-gray-600">(media only)</p>
                          )}
                          {a.audioUrl ? (
                            <audio
                              src={a.audioUrl}
                              controls
                              className="mt-1.5 h-8 max-w-full"
                              preload="metadata"
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {card.clips.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                        Sounds
                      </p>
                      {card.clips.map((clip) => (
                        <SoundClipRow
                          key={clip.id}
                          eventId={clip.eventId || event.id}
                          event={event}
                          clip={clip}
                          siblings={card.clips}
                          activePadId={activePadId}
                          onActivate={setActivePadId}
                        />
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
