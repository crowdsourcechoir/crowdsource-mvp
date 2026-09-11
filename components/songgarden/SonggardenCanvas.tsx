"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import DraggableAudioClip, { dragClipsToDesktop } from "./DraggableAudioClip";
import ClipDetailPanel from "./ClipDetailPanel";
import { useSonggardenPoll } from "./useSonggardenPoll";
import { SONGGARDEN_CATEGORIES } from "@/lib/songgarden/categories";
import type { SonggardenCategoryId, SonggardenClip } from "@/lib/songgarden/types";
import QueueFilterSelect from "@/components/sales/QueueFilterSelect";
import ComposerActionsMenu from "@/components/songgarden/ComposerActionsMenu";
import { deleteSonggardenClip } from "@/data/songgardenClient";
import {
  isAnonymousPersonName,
  normalizePersonKey,
} from "@/lib/agent-interview-qa";
import { groupAnswersByPrompt } from "@/lib/composer/group-answers-by-prompt";

type ComposerScope = "bloom" | "garden" | "master";
export type ContentView = "sounds" | "sounds_lyrics" | "text" | "video" | "all";

type GardenLink = { id: string; slug: string; title: string };
type ChapterLink = { id: string; eventId: string; label: string; index: number };

type TextItem = {
  id: string;
  participantName: string;
  questionText: string | null;
  content: string;
  createdAt: string;
  eventId: string;
  audioUrl: string | null;
  videoUrl: string | null;
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
  /** Bloom event id — when set, bloom-scoped sounds are available. */
  eventId?: string;
  eventTitle?: string;
  eventSlug?: string;
  /** Garden id or slug — opens garden composition without leaving Composer. */
  gardenId?: string;
  initialScope?: ComposerScope;
  /** Compact library switcher (Master / gardens / blooms). Replaces scope pills. */
  libraryPicker?: ReactNode;
  /** Agent theme — unlocks Generate Song Seed in the Actions menu. */
  agentThemeId?: string | null;
  /** Controlled Content filter. */
  contentView?: ContentView;
  onContentViewChange?: (next: ContentView) => void;
};

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export default function SonggardenCanvas({
  eventId = "",
  eventTitle = "Master Composer",
  eventSlug = "",
  gardenId = "",
  initialScope,
  libraryPicker,
  agentThemeId = null,
  contentView: contentViewProp,
  onContentViewChange,
}: Props) {
  const gardenOnly = Boolean(gardenId) && !eventId;
  const masterOnly = !eventId && !gardenId;
  const {
    clips: bloomClips,
    loading: bloomLoading,
    error: bloomError,
    newClipIds,
    clearNewHighlight,
    refresh: refreshBloom,
  } = useSonggardenPoll({ eventId, enabled: Boolean(eventId) });

  const [scope, setScope] = useState<ComposerScope>(
    initialScope ?? (gardenOnly ? "garden" : masterOnly ? "master" : "bloom")
  );
  const [contentViewInternal, setContentViewInternal] = useState<ContentView>("all");
  const contentView = contentViewProp ?? contentViewInternal;
  function setContentView(next: ContentView) {
    if (contentViewProp === undefined) setContentViewInternal(next);
    onContentViewChange?.(next);
  }
  const [categoryFilter, setCategoryFilter] = useState<SonggardenCategoryId | "all">("all");
  const [bloomFilterEventId, setBloomFilterEventId] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailClip, setDetailClip] = useState<SonggardenClip | null>(null);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

    if (gardenId) {
      (async () => {
        try {
          const res = await fetch(`/api/gardens/${encodeURIComponent(gardenId)}`, {
            cache: "no-store",
          });
          if (!res.ok || cancelled) return;
          const data = (await res.json()) as {
            garden?: GardenLink & { title?: string };
            chapters?: Array<{
              id: string;
              eventId?: string;
              event_id?: string;
              label?: string;
              title?: string;
              index?: number;
            }>;
          };
          if (cancelled || !data.garden) return;
          setGarden({
            id: data.garden.id,
            slug: data.garden.slug,
            title: data.garden.title ?? data.garden.slug,
          });
          setChapters(
            (data.chapters ?? []).map((ch, index) => ({
              id: ch.id,
              eventId: String(ch.eventId ?? ch.event_id ?? ""),
              label: String(ch.label ?? ch.title ?? `Chapter ${index + 1}`),
              index: ch.index ?? index,
            }))
          );
          setScope((prev) => (prev === "bloom" && gardenOnly ? "garden" : prev));
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
    }

    if (!eventId) {
      setGarden(null);
      setChapters([]);
      return;
    }

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
  }, [eventId, gardenId, gardenOnly]);

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
          const data = (await res.json().catch(() => ({}))) as {
            clips?: SonggardenClip[];
            error?: string;
          };
          if (!res.ok) {
            throw new Error(data.error || "Could not load master library.");
          }
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
    // Always load interview answers so Content=All (default) and the people/contrib
    // indicator stay accurate even after switching filters.
    const fromClips = (scope === "master" ? masterClips : gardenClips).map((c) => c.eventId);
    const rawIds =
      scope === "bloom"
        ? [eventId]
        : scope === "garden"
          ? chapters.length
            ? chapters.map((c) => c.eventId)
            : [eventId]
          : Array.from(new Set([...fromClips, eventId])).slice(0, 40);
    const eventIds = rawIds.filter(Boolean);

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
                  audioUrl: string | null;
                  videoUrl: string | null;
                  videoTranscript: string | null;
                }>;
              }>;
            };
            for (const item of data.items ?? []) {
              item.answers.forEach((answer, index) => {
                const text = answer.content?.trim() ?? "";
                const audioUrl = answer.audioUrl?.trim() || null;
                const videoUrl = answer.videoUrl?.trim() || null;
                // Text filter only wants typed text — skip media-only turns.
                if (text) {
                  texts.push({
                    id: `${item.conversationId}-t-${index}`,
                    participantName: item.participantName,
                    questionText: answer.questionText,
                    content: text,
                    createdAt: answer.createdAt,
                    eventId: id,
                    audioUrl,
                    videoUrl,
                  });
                }
                if (videoUrl) {
                  videos.push({
                    id: `${item.conversationId}-v-${index}`,
                    participantName: item.participantName,
                    questionText: answer.questionText,
                    videoUrl,
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
  }, [scope, eventId, chapters, gardenClips, masterClips]);

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
    // Content=Text: typed words only — never surface media-only rows here.
    if (contentView === "text") {
      list = list.filter((item) => item.content.trim().length > 0);
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
  }, [textItems, scope, bloomFilterEventId, search, contentView]);

  const textByPrompt = useMemo(
    () =>
      groupAnswersByPrompt(
        filteredText.map((item) => ({
          id: item.id,
          participantName: item.participantName,
          questionText: item.questionText,
          content: item.content,
          createdAt: item.createdAt,
          audioUrl: item.audioUrl,
          videoUrl: item.videoUrl,
          eventId: item.eventId,
        }))
      ),
    [filteredText]
  );

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

  const videoByPrompt = useMemo(
    () =>
      groupAnswersByPrompt(
        filteredVideo.map((item) => ({
          id: item.id,
          participantName: item.participantName,
          questionText: item.questionText,
          content: item.transcript?.trim() || "",
          createdAt: item.createdAt,
          videoUrl: item.videoUrl,
          eventId: item.eventId,
        }))
      ),
    [filteredVideo]
  );

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

  /** Scope totals (not search/category filtered) — foundation for richer analytics later. */
  const contributionStats = useMemo(() => {
    let texts = textItems;
    let videos = videoItems;
    if (scope === "garden" && bloomFilterEventId !== "all") {
      texts = texts.filter((item) => item.eventId === bloomFilterEventId);
      videos = videos.filter((item) => item.eventId === bloomFilterEventId);
    }
    const people = new Set<string>();
    for (const clip of scopedClips) {
      const name = clip.contributorName;
      people.add(
        isAnonymousPersonName(name)
          ? `clip:${clip.id}`
          : `name:${normalizePersonKey(name)}`
      );
    }
    for (const item of texts) {
      people.add(
        isAnonymousPersonName(item.participantName)
          ? `text:${item.id}`
          : `name:${normalizePersonKey(item.participantName)}`
      );
    }
    for (const item of videos) {
      people.add(
        isAnonymousPersonName(item.participantName)
          ? `video:${item.id}`
          : `name:${normalizePersonKey(item.participantName)}`
      );
    }
    return {
      people: people.size,
      contributions: scopedClips.length + texts.length + videos.length,
    };
  }, [scopedClips, textItems, videoItems, scope, bloomFilterEventId]);

  const loading =
    (scope === "bloom" ? bloomLoading : scopeLoading) || responsesLoading;

  function toggleSelect(clipId: string, multi: boolean) {
    setSelectedIds((prev) => {
      const next = multi ? new Set(prev) : new Set<string>();
      if (next.has(clipId) && multi) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  }

  function selectCategory(category: SonggardenCategoryId) {
    const ids = filteredClips
      .filter((clip) => clip.category === category)
      .map((clip) => clip.id);
    setSelectedIds(new Set(ids));
  }

  function deselectCategory(category: SonggardenCategoryId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const clip of filteredClips) {
        if (clip.category === category) next.delete(clip.id);
      }
      return next;
    });
  }

  function categoryAllSelected(category: SonggardenCategoryId): boolean {
    const ids = filteredClips
      .filter((clip) => clip.category === category)
      .map((clip) => clip.id);
    return ids.length > 0 && ids.every((id) => selectedIds.has(id));
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filteredClips.map((clip) => clip.id)));
  }

  function deselectAllFiltered() {
    const visible = new Set(filteredClips.map((clip) => clip.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of Array.from(visible)) next.delete(id);
      return next;
    });
  }

  const allFilteredSelected =
    filteredClips.length > 0 && filteredClips.every((clip) => selectedIds.has(clip.id));

  async function handleDeleteSelected() {
    if (selectedClips.length === 0) return;
    const label =
      selectedClips.length === 1
        ? `“${selectedClips[0].label || selectedClips[0].filename}”`
        : `${selectedClips.length} sounds`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setDeletingSelected(true);
    setDeleteError(null);
    try {
      for (const clip of selectedClips) {
        await deleteSonggardenClip(clip.eventId || eventId, clip.id);
      }
      setSelectedIds(new Set());
      if (detailClip && selectedClips.some((c) => c.id === detailClip.id)) {
        setDetailClip(null);
      }
      await refreshAll();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete sounds.");
      await refreshAll();
    } finally {
      setDeletingSelected(false);
    }
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
        const data = (await res.json().catch(() => ({}))) as {
          clips?: SonggardenClip[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Could not load master library.");
        setMasterClips(Array.isArray(data.clips) ? data.clips : []);
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-white">{pageTitle}</h1>
          <p
            className="mt-0.5 text-[11px] tabular-nums text-gray-500"
            title="Unique people and total contributions in this scope (sounds + text + video/photo). Counts ignore search and category filters."
          >
            {contributionStats.people}{" "}
            {contributionStats.people === 1 ? "person" : "people"}
            <span className="mx-1.5 text-gray-700" aria-hidden>
              ·
            </span>
            {contributionStats.contributions}{" "}
            {contributionStats.contributions === 1 ? "contrib" : "contribs"}
          </p>
        </div>
        <div className="flex max-w-3xl flex-1 flex-col items-stretch gap-2 sm:max-w-none sm:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {libraryPicker ? (
              libraryPicker
            ) : (
              <>
                {!masterOnly && !gardenOnly ? (
                  <QueueFilterSelect
                    label="Scope"
                    value={scope}
                    options={[
                      { key: "bloom", label: "This bloom" },
                      {
                        key: "garden",
                        label: garden ? "Song Garden" : "Song Garden (n/a)",
                      },
                      { key: "master", label: "Master" },
                    ]}
                    onChange={(next) => {
                      if (next === "garden" && !garden) return;
                      setScope(next);
                    }}
                  />
                ) : null}
                {gardenOnly || masterOnly ? (
                  <QueueFilterSelect
                    label="Scope"
                    value={scope}
                    options={
                      gardenOnly
                        ? [
                            { key: "garden", label: "This garden" },
                            { key: "master", label: "Master" },
                          ]
                        : [{ key: "master", label: "Master" }]
                    }
                    onChange={setScope}
                  />
                ) : null}
              </>
            )}

            <QueueFilterSelect
              label="Content"
              value={contentView}
              options={[
                { key: "all", label: "All" },
                { key: "sounds", label: "Sounds" },
                { key: "sounds_lyrics", label: "Sounds + lyrics" },
                { key: "text", label: "Text" },
                { key: "video", label: "Video" },
              ]}
              onChange={setContentView}
            />

            {showSounds ? (
              <QueueFilterSelect
                label="Category"
                value={categoryFilter}
                options={[
                  { key: "all", label: "All", count: scopedClips.length },
                  ...SONGGARDEN_CATEGORIES.map((category) => ({
                    key: category.id as SonggardenCategoryId | "all",
                    label: category.label,
                    count: scopedClips.filter((clip) => clip.category === category.id)
                      .length,
                  })),
                ]}
                onChange={setCategoryFilter}
              />
            ) : null}

            {scope === "garden" && chapters.length > 1 ? (
              <QueueFilterSelect
                label="Bloom"
                value={bloomFilterEventId}
                options={[
                  { key: "all", label: "All blooms" },
                  ...chapters.map((chapter) => ({
                    key: chapter.eventId,
                    label: chapter.label,
                  })),
                ]}
                onChange={setBloomFilterEventId}
              />
            ) : null}

            {eventId ? (
              <ComposerActionsMenu
                eventId={eventId}
                eventSlug={eventSlug || eventId}
                agentThemeId={agentThemeId}
                clips={bloomClips}
              />
            ) : null}

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search…"
              className="w-36 rounded-lg border border-white/15 bg-black px-3 py-1.5 text-xs text-white placeholder:text-gray-500 sm:w-44"
            />

            {selectedClips.length > 0 ? (
              <div
                draggable
                onDragStart={async (event) => {
                  try {
                    const byEvent = new Map<string, SonggardenClip[]>();
                    for (const clip of selectedClips) {
                      const id = clip.eventId || eventId;
                      const list = byEvent.get(id) ?? [];
                      list.push(clip);
                      byEvent.set(id, list);
                    }
                    for (const [id, clips] of Array.from(byEvent.entries())) {
                      await dragClipsToDesktop(id, clips, event.dataTransfer);
                    }
                  } catch {
                    event.preventDefault();
                  }
                }}
                className="cursor-grab rounded-lg border border-[var(--csc-accent)]/40 bg-[var(--csc-accent)]/10 px-3 py-1.5 text-xs font-medium text-[var(--csc-accent)] active:cursor-grabbing"
              >
                Drag {selectedClips.length}
              </div>
            ) : null}
          </div>
        </div>
      </div>

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
                const allSelected = categoryAllSelected(category.id);
                return (
                  <section key={category.id}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                        {category.label}
                      </h2>
                      <button
                        type="button"
                        onClick={() =>
                          allSelected
                            ? deselectCategory(category.id)
                            : selectCategory(category.id)
                        }
                        className="text-xs text-[#CFFF81] hover:underline"
                      >
                        {allSelected ? "Deselect all" : "Select all"}
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {list.map(renderClipCard)}
                    </div>
                  </section>
                );
              })
            : (
              <div className="space-y-3">
                {filteredClips.length > 0 ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        allFilteredSelected ? deselectAllFiltered() : selectAllFiltered()
                      }
                      className="text-xs text-[#CFFF81] hover:underline"
                    >
                      {allFilteredSelected ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredClips.map(renderClipCard)}
                </div>
              </div>
            )}
        </>
      ) : null}

      {showTextAlone ? (
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Text by prompt ({filteredText.length})
          </h2>
          {filteredText.length === 0 ? (
            <p className="text-sm text-gray-500">No text responses in this scope.</p>
          ) : (
            <div className="space-y-5">
              {textByPrompt.map((group) => (
                <div key={group.key} className="space-y-2">
                  <h3 className="text-sm font-medium text-white">{group.prompt}</h3>
                  <ul className="space-y-1 border-l border-white/10 pl-3">
                    {group.answers.map((item) => (
                      <li key={item.id} className="text-sm leading-snug text-gray-200">
                        <span className="text-gray-500">
                          {item.participantName || "Anonymous"} ·{" "}
                        </span>
                        <span className="whitespace-pre-wrap">{item.content}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {showVideo ? (
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Video & photo by prompt ({filteredVideo.length})
          </h2>
          {filteredVideo.length === 0 ? (
            <p className="text-sm text-gray-500">No video or photo responses in this scope.</p>
          ) : (
            <div className="space-y-5">
              {videoByPrompt.map((group) => (
                <div key={group.key} className="space-y-2">
                  <h3 className="text-sm font-medium text-white">{group.prompt}</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.answers.map((item) => {
                      const url = item.videoUrl || "";
                      const isPhoto =
                        /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url) || /\/photo-/i.test(url);
                      return (
                        <figure
                          key={item.id}
                          className="overflow-hidden rounded-xl border border-white/10 bg-black/30"
                        >
                          {isPhoto ? (
                            // eslint-disable-next-line @next/next/no-img-element -- contributor upload URL
                            <img
                              src={url}
                              alt=""
                              className="aspect-video w-full bg-black object-cover"
                            />
                          ) : (
                            <video src={url} controls className="aspect-video w-full bg-black" />
                          )}
                          <figcaption className="space-y-1 px-3 py-2">
                            <p className="text-xs text-gray-500">
                              {item.participantName || "Anonymous"}
                            </p>
                            {item.content ? (
                              <p className="line-clamp-3 text-xs text-gray-300">{item.content}</p>
                            ) : null}
                          </figcaption>
                        </figure>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {selectedIds.size > 0 && showSounds ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-gray-500">
            {selectedIds.size} selected · Shift-click to multi-select · drag any clip or use the batch
            drag handle
          </p>
          <button
            type="button"
            disabled={deletingSelected}
            onClick={() => void handleDeleteSelected()}
            className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-medium text-red-200 transition-colors hover:border-red-400 hover:text-red-100 disabled:opacity-50"
          >
            {deletingSelected ? "Deleting…" : `Delete selected (${selectedIds.size})`}
          </button>
          {deleteError ? <p className="text-xs text-red-300">{deleteError}</p> : null}
        </div>
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
          onDeleted={(clipId) => {
            setDetailClip(null);
            setSelectedIds((prev) => {
              if (!prev.has(clipId)) return prev;
              const next = new Set(prev);
              next.delete(clipId);
              return next;
            });
            void refreshAll();
          }}
        />
      ) : null}
    </div>
  );
}
