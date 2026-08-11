"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DraggableAudioClip, { dragClipsToDesktop } from "@/components/songgarden/DraggableAudioClip";
import { SONGGARDEN_CATEGORIES } from "@/lib/songgarden/categories";
import type { SonggardenCategoryId, SonggardenClip } from "@/lib/songgarden/types";

export type GardenCanvasClip = SonggardenClip & {
  zoneKey: string | null;
  chapterLabel: string | null;
};

export type GardenCanvasMark = {
  id: string;
  zoneKey: string | null;
  note: string;
  createdAt: string;
  kind: string;
};

type ZoneOption = { key: string; label: string };

type Props = {
  gardenId: string;
  gardenTitle: string;
  zones: ZoneOption[];
  publicHref?: string | null;
};

const POLL_MS = 5000;

export default function GardenCompositionCanvas({
  gardenId,
  gardenTitle,
  zones,
  publicHref,
}: Props) {
  const [clips, setClips] = useState<GardenCanvasClip[]>([]);
  const [marks, setMarks] = useState<GardenCanvasMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newClipIds, setNewClipIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [zoneFilter, setZoneFilter] = useState<string | "all" | "unzoned">("all");
  const [categoryFilter, setCategoryFilter] = useState<SonggardenCategoryId | "all">("all");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/gardens/${gardenId}/composition`, { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        clips?: GardenCanvasClip[];
        marks?: GardenCanvasMark[];
      };
      if (!res.ok) throw new Error(body.error || "Failed to load composition canvas");
      const nextClips = body.clips ?? [];
      setClips((prev) => {
        if (prev.length === 0) return nextClips;
        const known = new Set(prev.map((c) => c.id));
        const fresh = nextClips.filter((c) => !known.has(c.id)).map((c) => c.id);
        if (fresh.length) {
          setNewClipIds((ids) => {
            const merged = new Set(ids);
            fresh.forEach((id) => merged.add(id));
            return merged;
          });
        }
        return nextClips;
      });
      setMarks(body.marks ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [gardenId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    const t = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(t);
  }, [refresh]);

  const zoneScopedClips = useMemo(() => {
    if (zoneFilter === "all") return clips;
    if (zoneFilter === "unzoned") return clips.filter((c) => !c.zoneKey);
    return clips.filter((c) => c.zoneKey === zoneFilter);
  }, [clips, zoneFilter]);

  const filtered = useMemo(() => {
    if (categoryFilter === "all") return zoneScopedClips;
    return zoneScopedClips.filter((c) => c.category === categoryFilter);
  }, [zoneScopedClips, categoryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<SonggardenCategoryId, GardenCanvasClip[]>();
    for (const cat of SONGGARDEN_CATEGORIES) map.set(cat.id, []);
    for (const clip of filtered) {
      const list = map.get(clip.category) ?? [];
      list.push(clip);
      map.set(clip.category, list);
    }
    return map;
  }, [filtered]);

  const zoneScopedMarks = useMemo(() => {
    if (zoneFilter === "all") return marks;
    if (zoneFilter === "unzoned") return marks.filter((m) => !m.zoneKey);
    return marks.filter((m) => m.zoneKey === zoneFilter);
  }, [marks, zoneFilter]);

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
    const ids = zoneScopedClips.filter((c) => c.category === category).map((c) => c.id);
    setSelectedIds(new Set(ids));
  }

  function clearNewHighlight(clipId: string) {
    setNewClipIds((prev) => {
      const next = new Set(prev);
      next.delete(clipId);
      return next;
    });
  }

  const zoneCount = (key: string | "all" | "unzoned") => {
    if (key === "all") return clips.length;
    if (key === "unzoned") return clips.filter((c) => !c.zoneKey).length;
    return clips.filter((c) => c.zoneKey === key).length;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-gray-200">Composition canvas</h2>
          <p className="mt-1 text-xs text-gray-500">
            {gardenTitle} · sounds from attached shows · filter zone, then sound · drag into your
            DAW
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {publicHref ? (
            <a
              href={publicHref}
              className="rounded-lg border border-[#CFFF81]/40 px-3 py-2 text-sm text-[#CFFF81]"
            >
              Public drop / garden
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
          >
            Refresh
          </button>
          {selectedClips.length > 0 ? (
            <div
              draggable
              onDragStart={async (e) => {
                try {
                  // Batch drag uses each clip's own eventId via per-clip drag; for multi-event
                  // gardens, drag selected one-by-one if events differ.
                  const byEvent = new Map<string, GardenCanvasClip[]>();
                  for (const c of selectedClips) {
                    const list = byEvent.get(c.eventId) ?? [];
                    list.push(c);
                    byEvent.set(c.eventId, list);
                  }
                  const firstEvent = selectedClips[0]?.eventId;
                  const firstBatch = firstEvent ? byEvent.get(firstEvent) ?? [] : [];
                  if (firstEvent && firstBatch.length) {
                    await dragClipsToDesktop(firstEvent, firstBatch, e.dataTransfer);
                  }
                } catch {
                  e.preventDefault();
                }
              }}
              className="cursor-grab rounded-lg border border-[#CFFF81]/50 bg-[#CFFF81]/10 px-3 py-2 text-sm font-medium text-[#CFFF81] active:cursor-grabbing"
            >
              Drag {selectedClips.length} selected
            </div>
          ) : null}
        </div>
      </div>

      {/* Zone filter first */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Zone</span>
        <button
          type="button"
          onClick={() => setZoneFilter("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            zoneFilter === "all"
              ? "bg-[#CFFF81] text-[#1a1530]"
              : "border border-gray-600 text-gray-300 hover:bg-gray-800"
          }`}
        >
          All ({zoneCount("all")})
        </button>
        {zones.map((z) => (
          <button
            key={z.key}
            type="button"
            onClick={() => setZoneFilter(z.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              zoneFilter === z.key
                ? "bg-[#CFFF81] text-[#1a1530]"
                : "border border-gray-600 text-gray-300 hover:bg-gray-800"
            }`}
          >
            {z.label} ({zoneCount(z.key)})
          </button>
        ))}
        <button
          type="button"
          onClick={() => setZoneFilter("unzoned")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            zoneFilter === "unzoned"
              ? "bg-[#CFFF81] text-[#1a1530]"
              : "border border-gray-600 text-gray-300 hover:bg-gray-800"
          }`}
        >
          Unzoned ({zoneCount("unzoned")})
        </button>
      </div>

      {/* Sound filter second */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sound</span>
        <button
          type="button"
          onClick={() => setCategoryFilter("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            categoryFilter === "all"
              ? "bg-[#CFFF81] text-[#1a1530]"
              : "border border-gray-600 text-gray-300 hover:bg-gray-800"
          }`}
        >
          All ({zoneScopedClips.length})
        </button>
        {SONGGARDEN_CATEGORIES.map((cat) => {
          const count = zoneScopedClips.filter((c) => c.category === cat.id).length;
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

      {loading && clips.length === 0 ? (
        <p className="text-sm text-gray-500">Loading canvas…</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {!loading && clips.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-[#14141a] px-6 py-12 text-center">
          <p className="text-gray-400">No sounds in the garden yet.</p>
          <p className="mt-1 text-sm text-gray-500">
            Attach a show (chapter) and share that event’s Song Garden drop link — clips appear here.
            Zone taps on `/g` show up as marks below.
          </p>
        </div>
      ) : null}

      {clips.length > 0 && filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-[#14141a] px-6 py-8 text-center">
          <p className="text-sm text-gray-400">No clips match this zone + sound filter.</p>
        </div>
      ) : null}

      {categoryFilter === "all"
        ? SONGGARDEN_CATEGORIES.map((cat) => {
            const list = grouped.get(cat.id) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={cat.id}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                    {cat.label}
                  </h3>
                  <button
                    type="button"
                    onClick={() => selectCategory(cat.id)}
                    className="text-xs text-[#CFFF81] hover:underline"
                  >
                    Select all
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((clip) => (
                    <div key={clip.id} className="space-y-1">
                      <DraggableAudioClip
                        eventId={clip.eventId}
                        clip={clip}
                        selected={selectedIds.has(clip.id)}
                        isNew={newClipIds.has(clip.id)}
                        onSelectToggle={toggleSelect}
                        onPlayed={() => clearNewHighlight(clip.id)}
                      />
                      <p className="px-1 text-[10px] text-gray-500">
                        {clip.chapterLabel || "Show"}
                        {clip.zoneKey
                          ? ` · ${zones.find((z) => z.key === clip.zoneKey)?.label || clip.zoneKey}`
                          : " · unzoned"}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((clip) => (
              <div key={clip.id} className="space-y-1">
                <DraggableAudioClip
                  eventId={clip.eventId}
                  clip={clip}
                  selected={selectedIds.has(clip.id)}
                  isNew={newClipIds.has(clip.id)}
                  onSelectToggle={toggleSelect}
                  onPlayed={() => clearNewHighlight(clip.id)}
                />
                <p className="px-1 text-[10px] text-gray-500">
                  {clip.chapterLabel || "Show"}
                  {clip.zoneKey
                    ? ` · ${zones.find((z) => z.key === clip.zoneKey)?.label || clip.zoneKey}`
                    : " · unzoned"}
                </p>
              </div>
            ))}
          </div>
        )}

      {zoneScopedMarks.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Zone marks
          </h3>
          <ul className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-dashed border-gray-700 bg-[#14141a] p-3">
            {zoneScopedMarks.slice(0, 40).map((m) => (
              <li key={m.id} className="text-sm text-gray-300">
                <span className="text-[10px] uppercase tracking-wide text-gray-500">
                  {m.zoneKey
                    ? zones.find((z) => z.key === m.zoneKey)?.label || m.zoneKey
                    : "Unzoned"}{" "}
                  · {new Date(m.createdAt).toLocaleString()}
                </span>
                <p className="mt-0.5 text-white/90">{m.note}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {selectedIds.size > 0 ? (
        <p className="text-xs text-gray-500">
          {selectedIds.size} selected · Shift-click to multi-select · drag any clip or use the batch
          handle
        </p>
      ) : null}
    </div>
  );
}
