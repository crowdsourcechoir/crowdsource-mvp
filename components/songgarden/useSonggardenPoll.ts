"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listSonggardenClips, type SonggardenClip } from "@/data/songgardenClient";

type UseSonggardenPollOptions = {
  eventId: string;
  intervalMs?: number;
  enabled?: boolean;
};

export function useSonggardenPoll({
  eventId,
  intervalMs = 3000,
  enabled = true,
}: UseSonggardenPollOptions) {
  const [clips, setClips] = useState<SonggardenClip[]>([]);
  const [loading, setLoading] = useState(enabled && Boolean(eventId));
  const [error, setError] = useState<string | null>(null);
  const [newClipIds, setNewClipIds] = useState<Set<string>>(new Set());
  const knownIdsRef = useRef<Set<string>>(new Set());
  const latestAtRef = useRef<string | null>(null);

  const refresh = useCallback(async (initial = false) => {
    if (!eventId) return;
    try {
      const since = initial ? null : latestAtRef.current;
      const next = await listSonggardenClips(eventId, since);
      if (initial) {
        setClips(next);
        knownIdsRef.current = new Set(next.map((c) => c.id));
        latestAtRef.current = next[0]?.submittedAt ?? null;
      } else if (next.length > 0) {
        setClips((prev) => {
          const merged = [...next, ...prev.filter((p) => !next.some((n) => n.id === p.id))];
          merged.sort(
            (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
          );
          return merged;
        });
        const freshIds = next.filter((c) => !knownIdsRef.current.has(c.id)).map((c) => c.id);
        freshIds.forEach((id) => knownIdsRef.current.add(id));
        if (freshIds.length > 0) {
          setNewClipIds((prev) => {
            const merged = new Set(prev);
            freshIds.forEach((id) => merged.add(id));
            return merged;
          });
          latestAtRef.current = next[0]?.submittedAt ?? latestAtRef.current;
        }
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load clips");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!enabled || !eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh(true);
  }, [enabled, eventId, refresh]);

  useEffect(() => {
    if (!enabled || !eventId) return;
    const id = window.setInterval(() => void refresh(false), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, eventId, intervalMs, refresh]);

  const clearNewHighlight = useCallback((clipId: string) => {
    setNewClipIds((prev) => {
      const next = new Set(prev);
      next.delete(clipId);
      return next;
    });
  }, []);

  return { clips, loading, error, newClipIds, clearNewHighlight, refresh: () => refresh(true) };
}
