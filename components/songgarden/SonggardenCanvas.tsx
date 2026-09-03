"use client";

import { useMemo, useState } from "react";
import DraggableAudioClip, { dragClipsToDesktop } from "./DraggableAudioClip";
import ClipDetailPanel from "./ClipDetailPanel";
import { useSonggardenPoll } from "./useSonggardenPoll";
import {
  SONGGARDEN_CATEGORIES,
} from "@/lib/songgarden/categories";
import type { SonggardenCategoryId, SonggardenClip } from "@/lib/songgarden/types";

type SonggardenCanvasProps = {
  eventId: string;
  eventTitle: string;
};

export default function SonggardenCanvas({ eventId, eventTitle }: SonggardenCanvasProps) {
  const { clips, loading, error, newClipIds, clearNewHighlight, refresh } = useSonggardenPoll({
    eventId,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<SonggardenCategoryId | "all">("all");
  const [detailClip, setDetailClip] = useState<SonggardenClip | null>(null);

  const filtered = useMemo(() => {
    if (categoryFilter === "all") return clips;
    return clips.filter((c) => c.category === categoryFilter);
  }, [clips, categoryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<SonggardenCategoryId, SonggardenClip[]>();
    for (const cat of SONGGARDEN_CATEGORIES) map.set(cat.id, []);
    for (const clip of filtered) {
      const list = map.get(clip.category) ?? [];
      list.push(clip);
      map.set(clip.category, list);
    }
    return map;
  }, [filtered]);

  const selectedClips = clips.filter((c) => selectedIds.has(c.id));

  function toggleSelect(clipId: string, multi: boolean) {
    setSelectedIds((prev) => {
      const next = multi ? new Set(prev) : new Set<string>();
      if (next.has(clipId) && multi) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  }

  function selectCategory(category: SonggardenCategoryId) {
    const ids = clips.filter((c) => c.category === category).map((c) => c.id);
    setSelectedIds(new Set(ids));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Song Garden</h1>
          <p className="mt-1 text-sm text-gray-400">
            {eventTitle} · drag clips into Ableton, Suno, or your DAW
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
          >
            Refresh
          </button>
          {selectedClips.length > 0 && (
            <div
              draggable
              onDragStart={async (e) => {
                try {
                  await dragClipsToDesktop(eventId, selectedClips, e.dataTransfer);
                } catch {
                  e.preventDefault();
                }
              }}
              className="cursor-grab rounded-lg border border-[#CFFF81]/50 bg-[#CFFF81]/10 px-3 py-2 text-sm font-medium text-[#CFFF81] active:cursor-grabbing"
            >
              Drag {selectedClips.length} selected
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Filter</span>
        <button
          type="button"
          onClick={() => setCategoryFilter("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            categoryFilter === "all"
              ? "bg-[#CFFF81] text-[#1a1530]"
              : "border border-gray-600 text-gray-300 hover:bg-gray-800"
          }`}
        >
          All ({clips.length})
        </button>
        {SONGGARDEN_CATEGORIES.map((cat) => {
          const count = clips.filter((c) => c.category === cat.id).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                categoryFilter === cat.id
                  ? "bg-[#CFFF81] text-[#1a1530]"
                  : "border border-gray-600 text-gray-300 hover:bg-gray-800"
              }`}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {loading && clips.length === 0 && (
        <p className="text-sm text-gray-500">Loading canvas…</p>
      )}
      {error && (
        <p className="rounded-lg border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {!loading && clips.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-700 bg-[#14141a] px-6 py-12 text-center">
          <p className="text-gray-400">No sounds in the garden yet.</p>
          <p className="mt-1 text-sm text-gray-500">
            Share the Song Garden link with ticket holders — new drops appear here automatically.
          </p>
        </div>
      )}

      {categoryFilter === "all" ? (
        SONGGARDEN_CATEGORIES.map((cat) => {
          const list = grouped.get(cat.id) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={cat.id}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                  {cat.label}
                </h2>
                <button
                  type="button"
                  onClick={() => selectCategory(cat.id)}
                  className="text-xs text-[#CFFF81] hover:underline"
                >
                  Select all
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {list.map((clip) => (
                  <DraggableAudioClip
                    key={clip.id}
                    eventId={eventId}
                    clip={clip}
                    selected={selectedIds.has(clip.id)}
                    isNew={newClipIds.has(clip.id)}
                    onSelectToggle={toggleSelect}
                    onPlayed={() => clearNewHighlight(clip.id)}
                    onOpenDetail={setDetailClip}
                  />
                ))}
              </div>
            </section>
          );
        })
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((clip) => (
            <DraggableAudioClip
              key={clip.id}
              eventId={eventId}
              clip={clip}
              selected={selectedIds.has(clip.id)}
              isNew={newClipIds.has(clip.id)}
              onSelectToggle={toggleSelect}
              onPlayed={() => clearNewHighlight(clip.id)}
              onOpenDetail={setDetailClip}
            />
          ))}
        </div>
      )}

      {selectedIds.size > 0 && (
        <p className="text-xs text-gray-500">
          {selectedIds.size} selected · Shift-click to multi-select · drag any clip or use the batch
          drag handle
        </p>
      )}

      {detailClip ? (
        <ClipDetailPanel
          eventId={eventId}
          clip={detailClip}
          onClose={() => setDetailClip(null)}
          onUpdated={(updated) => {
            setDetailClip(updated);
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}
