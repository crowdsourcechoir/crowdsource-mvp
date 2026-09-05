"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DraggableAudioClip, { dragClipsToDesktop } from "./DraggableAudioClip";
import ClipDetailPanel from "./ClipDetailPanel";
import { useSonggardenPoll } from "./useSonggardenPoll";
import { SONGGARDEN_CATEGORIES } from "@/lib/songgarden/categories";
import type { SonggardenCategoryId, SonggardenClip } from "@/lib/songgarden/types";

type ComposerScope = "bloom" | "garden" | "master";
type ContentView = "sounds" | "sounds_lyrics" | "text" | "video" | "all";

type GardenLink = { id: string; slug: string; title: string };
type ChapterLink = { id: string; eventId: string; label: string; index: number };

type TextItem = {
  id: string;
  participantName: string;
  questionText: string | null;
  content: string;
  createdAt: string;
  eventId: string;
};

type VideoItem = {
  id: string;
  participantName: string;
  questionText: string | null;
  videoUrl: string;
  transcript: string | null;
  createdAt: string;
  eventId: string;
};

type Props = {
  eventId: string;
  eventTitle: string;
  eventSlug: string;
};

function pillClass(active: boolean): string {
  return active
    ? "bg-[#CFFF81] text-[#1a1530]"
    : "border border-gray-600 text-gray-300 hover:bg-gray-800";
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export default function SonggardenCanvas({ eventId, eventTitle, eventSlug }: Props) {
  const {
    clips: bloomClips,
    loading: bloomLoading,
    error: bloomError,
    newClipIds,
    clearNewHighlight,
    refresh: refreshBloom,
  } = useSonggardenPoll({ eventId });

  const [scope, setScope] = useState<ComposerScope>("bloom");
  const [contentView, setContentView] = useState<ContentView>("sounds");
  const [categoryFilter, setCategoryFilter] = useState<SonggardenCategoryId | "all">("all");
  const [bloomFilterEventId, setBloomFilterEventId] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailClip, setDetailClip] = useState<SonggardenClip | null>(null);

  const [garden, setGarden] = useState<GardenLink | null>(null);
  const [chapters, setChapters] = useState<ChapterLink[]>([]);
  const [gardenClips, setGardenClips] = useState<SonggardenClip[]>([]);
  const [masterClips, setMasterClips] = useState<SonggardenClip[]>([]);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [videoItems, setVideoItems] = useState<VideoItem[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/gardens/by-event?eventId=${encodeURIComponent(eventId)}`,
          { cache: "no-store" }
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          garden: GardenLink | null;
          chapters?: ChapterLink[];
        };
        if (cancelled) return;
        setGarden(data.garden ?? null);
        setChapters(Array.isArray(data.chapters) ? data.chapters : []);
      } catch {
        if (!cancelled) {
          setGarden(null);
          setChapters([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (scope === "bloom") return;
    let cancelled = false;
    setScopeLoading(true);
    setScopeError(null);
    (async () => {
      try {
        if (scope === "garden") {
          if (!garden?.id) {
            setGardenClips([]);
            return;
          }
          const res = await fetch(`/api/gardens/${encodeURIComponent(garden.id)}/composition`, {
            cache: "no-store",
          });
          if (!res.ok) throw new Error("Could not load garden composition.");
          const data = (await res.json()) as { clips?: SonggardenClip[] };
          if (!cancelled) setGardenClips(Array.isArray(data.clips) ? data.clips : []);
        } else {
          const res = await fetch("/api/admin/composer/library", { cache: "no-store" });
          if (!res.ok) throw new Error("Could not load master library.");
          const data = (await res.json()) as { clips?: SonggardenClip[] };
          if (!cancelled) setMasterClips(Array.isArray(data.clips) ? data.clips : []);
        }
      } catch (err) {
        if (!cancelled) {
          setScopeError(err instanceof Error ? err.message : "Failed to load library.");
        }
      } finally {
        if (!cancelled) setScopeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, garden?.id]);

  useEffect(() => {
    const needsResponses =
      contentView === "sounds_lyrics" ||
      contentView === "text" ||
      contentView === "video" ||
      contentView === "all";
    if (!needsResponses) return;

    const fromClips = (scope === "master" ? masterClips : gardenClips).map((c) => c.eventId);
    const eventIds =
      scope === "bloom"
        ? [eventId]
        : scope === "garden"
          ? chapters.length
            ? chapters.map((c) => c.eventId)
            : [eventId]
          : Array.from(new Set([...fromClips, eventId])).slice(0, 40);

    let cancelled = false;
    setResponsesLoading(true);
    (async () => {
      try {
        const texts: TextItem[] = [];
        const videos: VideoItem[] = [];
        await Promise.all(
          eventIds.map(async (id) => {
            const res = await fetch(
              `/api/agent/interview-submissions?eventId=${encodeURIComponent(id)}`,
              { cache: "no-store" }
            );
            if (!res.ok) return;
            const data = (await res.json()) as {
              items?: Array<{
                participantName: string;
                conversationId: string;
                answers: Array<{
                  createdAt: string;
                  content: string;
                  questionText: string | null;
                  videoUrl: string | null;
                  videoTranscript: string | null;
                }>;
              }>;
            };
            for (const item of data.items ?? []) {
              item.answers.forEach((answer, index) => {
                if (answer.content?.trim()) {
                  texts.push({
                    id: `${item.conversationId}-t-${index}`,
                    participantName: item.participantName,
                    questionText: answer.questionText,
                    content: answer.content.trim(),
                    createdAt: answer.createdAt,
                    eventId: id,
                  });
                }
                if (answer.videoUrl) {
                  videos.push({
                    id: `${item.conversationId}-v-${index}`,
                    participantName: item.participantName,
                    questionText: answer.questionText,
                    videoUrl: answer.videoUrl,
                    transcript: answer.videoTranscript,
                    createdAt: answer.createdAt,
                    eventId: id,
                  });
                }
              });
            }
          })
        );
        if (!cancelled) {
          setTextItems(texts);
          setVideoItems(videos);
        }
      } catch {
        if (!cancelled) {
          setTextItems([]);
          setVideoItems([]);
        }
      } finally {
        if (!cancelled) setResponsesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contentView, scope, eventId, chapters, gardenClips, masterClips]);

  const baseClips = useMemo(() => {
    if (scope === "garden") return gardenClips;
    if (scope === "master") return masterClips;
    return bloomClips;
  }, [scope, gardenClips, masterClips, bloomClips]);

  const scopedClips = useMemo(() => {
    if (scope === "garden" && bloomFilterEventId !== "all") {
      return baseClips.filter((clip) => clip.eventId === bloomFilterEventId);
    }
    return baseClips;
  }, [baseClips, scope, bloomFilterEventId]);

  const filteredClips = useMemo(() => {
    let list = scopedClips;
    if (categoryFilter !== "all") {
      list = list.filter((clip) => clip.category === categoryFilter);
    }
    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter((clip) =>
        `${clip.label ?? ""} ${clip.contributorName ?? ""} ${clip.category} ${clip.filename}`
          .toLowerCase()
          .includes(query)
      );
    }
    return list;
  }, [scopedClips, categoryFilter, search]);

  const filteredText = useMemo(() => {
    let list = textItems;
    if (scope === "garden" && bloomFilterEventId !== "all") {
      list = list.filter((item) => item.eventId === bloomFilterEventId);
    }
    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter((item) =>
        `${item.participantName} ${item.content} ${item.questionText ?? ""}`
          .toLowerCase()
          .includes(query)
      );
    }
    return list;
  }, [textItems, scope, bloomFilterEventId, search]);

  const filteredVideo = useMemo(() => {
    let list = videoItems;
    if (scope === "garden" && bloomFilterEventId !== "all") {
      list = list.filter((item) => item.eventId === bloomFilterEventId);
    }
    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter((item) =>
        `${item.participantName} ${item.transcript ?? ""} ${item.questionText ?? ""}`
          .toLowerCase()
          .includes(query)
      );
    }
    return list;
  }, [videoItems, scope, bloomFilterEventId, search]);

  const lyricByContributor = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of filteredText) {
      const key = normalizeName(item.participantName);
      if (!key || map.has(key)) continue;
      map.set(key, item.content);
    }
    return map;
  }, [filteredText]);

  const grouped = useMemo(() => {
    const map = new Map<SonggardenCategoryId, SonggardenClip[]>();
    for (const category of SONGGARDEN_CATEGORIES) map.set(category.id, []);
    for (const clip of filteredClips) {
      const list = map.get(clip.category) ?? [];
      list.push(clip);
      map.set(clip.category, list);
    }
    return map;
  }, [filteredClips]);

  const selectedClips = filteredClips.filter((clip) => selectedIds.has(clip.id));
  const pageTitle =
    scope === "garden" && garden
      ? garden.title
      : scope === "master"
        ? "Master Composer"
        : eventTitle;

  const showSounds =
    contentView === "sounds" || contentView === "sounds_lyrics" || contentView === "all";
  const showTextAlone = contentView === "text" || contentView === "all";
  const showLyricsUnderSounds = contentView === "sounds_lyrics" || contentView === "all";
  const showVideo = contentView === "video" || contentView === "all";

  const loading =
    (scope === "bloom" ? bloomLoading : scopeLoading) ||
    ((showTextAlone || showLyricsUnderSounds || showVideo) && responsesLoading);

  function toggleSelect(clipId: string, multi: boolean) {
    setSelectedIds((prev) => {
      const next = multi ? new Set(prev) : new Set<string>();
      if (next.has(clipId) && multi) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  }

  function selectCategory(category: SonggardenCategoryId) {
    setSelectedIds(
      new Set(filteredClips.filter((clip) => clip.category === category).map((clip) => clip.id))
    );
  }

  async function refreshAll() {
    if (scope === "bloom") {
      await refreshBloom();
      return;
    }
    setScopeLoading(true);
    try {
      if (scope === "garden" && garden?.id) {
        const res = await fetch(`/api/gardens/${encodeURIComponent(garden.id)}/composition`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as { clips?: SonggardenClip[] };
          setGardenClips(Array.isArray(data.clips) ? data.clips : []);
        }
      } else if (scope === "master") {
        const res = await fetch("/api/admin/composer/library", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { clips?: SonggardenClip[] };
          setMasterClips(Array.isArray(data.clips) ? data.clips : []);
        }
      }
    } finally {
      setScopeLoading(false);
    }
  }

  function renderClipCard(clip: SonggardenClip) {
    const clipEventId = clip.eventId || eventId;
    const lyric = lyricByContributor.get(normalizeName(clip.contributorName));
    return (
      <div key={clip.id} className="space-y-1">
        <DraggableAudioClip
          eventId={clipEventId}
          clip={clip}
          selected={selectedIds.has(clip.id)}
          isNew={newClipIds.has(clip.id)}
          onSelectToggle={toggleSelect}
          onPlayed={() => clearNewHighlight(clip.id)}
          onOpenDetail={setDetailClip}
        />
        {showLyricsUnderSounds ? (
          <p className="line-clamp-3 px-1 text-[11px] leading-snug text-gray-400">
            {lyric || "No linked lyric"}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">{pageTitle}</h1>
          <p className="mt-1 text-xs text-gray-500">
            {scope === "bloom" && (
              <>
                Bloom composer ·{" "}
                <span className="font-mono text-gray-400">/admin/songgarden/{eventSlug}</span>
              </>
            )}
            {scope === "garden" && garden ? <>Song Garden library · all blooms in this garden</> : null}
            {scope === "master" ? <>Complete Song Garden library</> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
          >
            Refresh
          </button>
          {selectedClips.length > 0 ? (
            <div
              draggable
              onDragStart={async (event) => {
                try {
                  await dragClipsToDesktop(eventId, selectedClips, event.dataTransfer);
                } catch {
                  event.preventDefault();
                }
              }}
              className="cursor-grab rounded-lg border border-[#CFFF81]/50 bg-[#CFFF81]/10 px-3 py-2 text-sm font-medium text-[#CFFF81] active:cursor-grabbing"
            >
              Drag {selectedClips.length} selected
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Scope</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setScope("bloom")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${pillClass(scope === "bloom")}`}
          >
            This bloom
          </button>
          <button
            type="button"
            disabled={!garden}
            title={garden ? garden.title : "Attach this bloom to a Song Garden to enable"}
            onClick={() => {
              if (garden) setScope("garden");
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${pillClass(scope === "garden")}`}
          >
            Song Garden{garden ? ` · ${garden.title}` : ""}
          </button>
          <button
            type="button"
            onClick={() => setScope("master")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${pillClass(scope === "master")}`}
          >
            Master Composer
          </button>
          {garden ? (
            <Link href={`/admin/gardens/${garden.id}`} className="text-xs text-[#CFFF81] hover:underline">
              Garden admin →
            </Link>
          ) : null}
        </div>
        {scope === "garden" && chapters.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-gray-500">Bloom</span>
            <button
              type="button"
              onClick={() => setBloomFilterEventId("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${pillClass(bloomFilterEventId === "all")}`}
            >
              All blooms
            </button>
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => setBloomFilterEventId(chapter.eventId)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${pillClass(bloomFilterEventId === chapter.eventId)}`}
              >
                {chapter.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">View</span>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["sounds", "Sounds"],
              ["sounds_lyrics", "Sounds + lyrics"],
              ["text", "Text only"],
              ["video", "Video"],
              ["all", "All responses"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setContentView(id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${pillClass(contentView === id)}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search library…"
        className="w-full max-w-md rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-500"
      />

      {showSounds ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Sound filter
          </span>
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${pillClass(categoryFilter === "all")}`}
          >
            All ({scopedClips.length})
          </button>
          {SONGGARDEN_CATEGORIES.map((category) => {
            const count = scopedClips.filter((clip) => clip.category === category.id).length;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryFilter(category.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${pillClass(categoryFilter === category.id)}`}
              >
                {category.label} ({count})
              </button>
            );
          })}
        </div>
      ) : null}

      {loading &&
      filteredClips.length === 0 &&
      filteredText.length === 0 &&
      filteredVideo.length === 0 ? (
        <p className="text-sm text-gray-500">Loading canvas…</p>
      ) : null}
      {(bloomError || scopeError) && (
        <p className="rounded-lg border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {bloomError || scopeError}
        </p>
      )}

      {showSounds ? (
        <>
          {!loading && filteredClips.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-700 bg-[#14141a] px-6 py-10 text-center">
              <p className="text-gray-400">No sounds in this scope yet.</p>
            </div>
          ) : null}

          {categoryFilter === "all"
            ? SONGGARDEN_CATEGORIES.map((category) => {
                const list = grouped.get(category.id) ?? [];
                if (list.length === 0) return null;
                return (
                  <section key={category.id}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                        {category.label}
                      </h2>
                      <button
                        type="button"
                        onClick={() => selectCategory(category.id)}
                        className="text-xs text-[#CFFF81] hover:underline"
                      >
                        Select all
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {list.map(renderClipCard)}
                    </div>
                  </section>
                );
              })
            : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredClips.map(renderClipCard)}
              </div>
            )}
        </>
      ) : null}

      {showTextAlone ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Text responses ({filteredText.length})
          </h2>
          {filteredText.length === 0 ? (
            <p className="text-sm text-gray-500">No text responses in this scope.</p>
          ) : (
            <ul className="space-y-2">
              {filteredText.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                >
                  <p className="text-xs text-gray-500">
                    {item.participantName}
                    {item.questionText ? ` · ${item.questionText}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-white">{item.content}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {showVideo ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Video responses ({filteredVideo.length})
          </h2>
          {filteredVideo.length === 0 ? (
            <p className="text-sm text-gray-500">No video responses in this scope.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredVideo.map((item) => (
                <figure
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-black/30"
                >
                  <video src={item.videoUrl} controls className="aspect-video w-full bg-black" />
                  <figcaption className="space-y-1 px-3 py-2">
                    <p className="text-xs text-gray-500">{item.participantName}</p>
                    {item.questionText ? (
                      <p className="text-[11px] text-gray-400">{item.questionText}</p>
                    ) : null}
                    {item.transcript ? (
                      <p className="line-clamp-3 text-xs text-gray-300">{item.transcript}</p>
                    ) : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {selectedIds.size > 0 && showSounds ? (
        <p className="text-xs text-gray-500">
          {selectedIds.size} selected · Shift-click to multi-select · drag any clip or use the batch
          drag handle
        </p>
      ) : null}

      {detailClip ? (
        <ClipDetailPanel
          eventId={detailClip.eventId || eventId}
          clip={detailClip}
          onClose={() => setDetailClip(null)}
          onUpdated={(updated) => {
            setDetailClip(updated);
            void refreshAll();
          }}
        />
      ) : null}
    </div>
  );
}
