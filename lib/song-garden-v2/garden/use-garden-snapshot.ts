"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getOrCreateSonggardenDeviceId } from "@/data/songgardenClient";
import type { GardenSnapshot, WorldEffect } from "./types";

const POLL_MS = 25_000;

export type UseGardenSnapshotResult = {
  snapshot: GardenSnapshot | null;
  linked: boolean;
  loading: boolean;
  refresh: () => Promise<GardenSnapshot | null>;
  applyLocalEffects: (effects: WorldEffect[] | null | undefined) => void;
};

/**
 * Polls the event→garden snapshot when the event is chapter-linked.
 * 404 ⇒ not linked (V2 local-growth mode).
 */
export function useGardenSnapshot(eventId: string): UseGardenSnapshotResult {
  const [snapshot, setSnapshot] = useState<GardenSnapshot | null>(null);
  const [linked, setLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const eventIdRef = useRef(eventId);
  eventIdRef.current = eventId;

  const refresh = useCallback(async (): Promise<GardenSnapshot | null> => {
    const id = eventIdRef.current;
    try {
      const deviceId = getOrCreateSonggardenDeviceId();
      const params = new URLSearchParams();
      if (deviceId) params.set("deviceId", deviceId);
      const res = await fetch(`/api/events/${id}/garden-snapshot?${params}`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        setLinked(false);
        setSnapshot(null);
        return null;
      }
      if (!res.ok) return snapshot;
      const data = (await res.json()) as GardenSnapshot;
      setLinked(true);
      setSnapshot(data);
      return data;
    } catch {
      return snapshot;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: refresh reads latest snapshot only as fallback
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const data = await refresh();
      if (cancelled) return;
      if (!data) setLoading(false);
    })();
    const interval = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [eventId, refresh]);

  const applyLocalEffects = useCallback((_effects: WorldEffect[] | null | undefined) => {
    void refresh();
  }, [refresh]);

  return { snapshot, linked, loading, refresh, applyLocalEffects };
}
