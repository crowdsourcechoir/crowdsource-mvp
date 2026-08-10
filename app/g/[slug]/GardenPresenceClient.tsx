"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getOrCreateSonggardenDeviceId } from "@/data/songgardenClient";
import type { ContributionKind, GardenSnapshot } from "@/lib/song-garden-v2/garden/types";
import { worldConfigFromBrand } from "@/lib/song-garden-v2/garden/snapshot";
import { resolveWorldConfig } from "@/lib/song-garden-v2/world-config";
import type { WorldGrowthNode } from "@/lib/song-garden-v2/growth-nodes";
import WorldStage from "@/components/song-garden-v2/WorldStage";
import CelebrationBurst from "@/components/song-garden-v2/CelebrationBurst";
import { useCelebration } from "@/components/song-garden-v2/engine/useCelebration";
import { pulseHaptic } from "@/lib/song-garden-v2/haptics";

type Props = {
  gardenSlug: string;
  gardenTitle: string;
};

const POLL_MS = 25_000;
const ZOOM_SCALE = 2.45;
const ZOOM_MS = 0.75;

export default function GardenPresenceClient({ gardenSlug, gardenTitle }: Props) {
  const [snapshot, setSnapshot] = useState<GardenSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [burstMessage, setBurstMessage] = useState("The garden stirred");
  const [unlocked, setUnlocked] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [mapAspect, setMapAspect] = useState(1600 / 1102);
  const celebration = useCelebration();

  const refresh = useCallback(async () => {
    try {
      const deviceId = getOrCreateSonggardenDeviceId();
      const params = new URLSearchParams();
      if (deviceId) params.set("deviceId", deviceId);
      const res = await fetch(`/api/gardens/${gardenSlug}/snapshot?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Could not load garden");
      }
      const data = (await res.json()) as GardenSnapshot;
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [gardenSlug]);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(t);
  }, [refresh]);

  const fallbackEvent = useMemo(
    () =>
      ({
        title: gardenTitle,
        heroImage: "",
        worldConfig: null,
      }) as Parameters<typeof resolveWorldConfig>[0],
    [gardenTitle]
  );

  const world = useMemo(() => {
    const base = resolveWorldConfig(fallbackEvent);
    if (!snapshot) return base;
    const merged = worldConfigFromBrand(snapshot.brand, base);
    return { ...merged, heroArtworkUrl: null };
  }, [fallbackEvent, snapshot]);

  const mapArtworkUrl = snapshot?.brand.heroArtworkUrl ?? null;

  const growthNodes = useMemo((): WorldGrowthNode[] => {
    if (!snapshot) return [];
    return snapshot.myMarks.map((m) => ({
      id: `mark_${m.id}`,
      kind: m.kind as ContributionKind,
      index: m.index,
      createdAt: Date.parse(m.createdAt) || Date.now(),
      emphasis: "personal" as const,
    }));
  }, [snapshot]);

  function selectZone(key: string) {
    setUnlocked(true);
    setSelectedZone(key);
    setResponse("");
    setError(null);
  }

  function closeZone() {
    setSelectedZone(null);
    setResponse("");
    setError(null);
  }

  async function handlePulse() {
    if (!snapshot?.window.canContribute || pulsing) return;
    if ((snapshot.zones?.length ?? 0) > 0 && !selectedZone) {
      setError("Tap a zone on the map to engage.");
      return;
    }
    setUnlocked(true);
    setPulsing(true);
    setError(null);
    try {
      const res = await fetch(`/api/gardens/${gardenSlug}/pulse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: getOrCreateSonggardenDeviceId(),
          kind: "text",
          zoneKey: selectedZone,
          note: response.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        gardenCelebrationLine?: string | null;
      };
      if (!res.ok) throw new Error(body.error || "Could not leave a mark");
      pulseHaptic();
      setBurstMessage(body.gardenCelebrationLine?.trim() || "You left a mark");
      setResponse("");
      celebration.celebrate(() => {
        setSelectedZone(null);
        void refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pulse failed");
    } finally {
      setPulsing(false);
    }
  }

  const energy = snapshot?.state.energy ?? 0;
  const chapterLink = snapshot?.activeChapter?.eventSlug
    ? `/e/${snapshot.activeChapter.eventSlug}`
    : null;
  const zones = snapshot?.zones ?? [];
  const selectedMeta = zones.find((z) => z.key === selectedZone) ?? null;
  const zoomed = Boolean(selectedMeta);
  const prompt =
    selectedMeta?.prompt?.trim() ||
    selectedMeta?.blurb?.trim() ||
    "Leave a mark in this zone.";
  const cta =
    selectedMeta?.ctaLabel?.trim() ||
    (selectedMeta ? `Leave a mark in ${selectedMeta.label}` : "Leave a mark");
  const placeholder =
    selectedMeta?.inputPlaceholder?.trim() || "Type your response…";

  const originX = selectedMeta ? selectedMeta.x * 100 : 50;
  const originY = selectedMeta ? selectedMeta.y * 100 : 50;

  return (
    <WorldStage
      world={world}
      energyLevel={energy}
      celebrationTrigger={celebration.trigger}
      soundtrackUnlocked={unlocked}
      growthNodes={growthNodes}
    >
      {zones.length > 0 && mapArtworkUrl ? (
        <div className="relative z-10 min-h-[100dvh] w-full overflow-hidden">
          {/* Map is the world plane — expands into the selected zone */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute inset-0 flex items-center justify-center will-change-transform"
              animate={{ scale: zoomed ? ZOOM_SCALE : 1 }}
              transition={{ duration: ZOOM_MS, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: `${originX}% ${originY}%` }}
            >
              <div
                className="relative"
                style={{
                  aspectRatio: String(mapAspect),
                  width: "100vw",
                  minHeight: "100dvh",
                  // Cover the viewport the way Song Garden worlds do.
                  minWidth: "max(100vw, calc(100dvh * " + mapAspect + "))",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mapArtworkUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                      setMapAspect(img.naturalWidth / img.naturalHeight);
                    }
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-0 transition-opacity duration-500"
                  style={{
                    background: zoomed
                      ? "radial-gradient(circle at center, transparent 15%, rgba(0,0,0,0.5) 90%)"
                      : "linear-gradient(to top, rgba(0,0,0,0.4), transparent 45%, rgba(0,0,0,0.28))",
                  }}
                />

                {zones.map((z) => {
                  const active = selectedZone === z.key;
                  const glow = Math.round((z.runtime?.energy ?? 0) * 100);
                  const dimmed = zoomed && !active;
                  return (
                    <button
                      key={z.key}
                      type="button"
                      onClick={() => selectZone(z.key)}
                      className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border px-2.5 py-1.5 text-left text-[11px] font-medium shadow-lg backdrop-blur-sm transition-opacity"
                      style={{
                        left: `${z.x * 100}%`,
                        top: `${z.y * 100}%`,
                        borderColor: active ? world.accentColor : "rgba(255,255,255,0.35)",
                        background: active ? `${world.accentColor}cc` : "rgba(0,0,0,0.72)",
                        color: active ? "#0a0a0a" : "#fff",
                        opacity: dimmed ? 0.12 : 1,
                        pointerEvents: dimmed ? "none" : "auto",
                        boxShadow: active
                          ? `0 0 22px ${world.accentColor}`
                          : glow > 5
                            ? `0 0 ${8 + glow / 8}px ${world.accentColor}66`
                            : "0 2px 10px rgba(0,0,0,0.45)",
                      }}
                    >
                      <span className="block whitespace-nowrap">{z.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-4 pt-[max(0.85rem,env(safe-area-inset-top))]">
            <div className="pointer-events-auto min-w-0">
              {world.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={world.logoUrl}
                  alt=""
                  className="mb-1 h-7 w-auto opacity-95 drop-shadow"
                />
              ) : null}
              <p
                className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.28em] drop-shadow"
                style={{ color: world.accentColor }}
              >
                {snapshot?.brand.title || gardenTitle}
              </p>
            </div>
            <div className="pointer-events-auto shrink-0 rounded-full border border-white/15 bg-black/50 px-3 py-1 font-mono text-[11px] text-white/85 backdrop-blur-md">
              {energy.toFixed(2)} · {snapshot?.state.totals.contributions ?? 0} marks
            </div>
          </div>

          <AnimatePresence>
            {!zoomed ? (
              <motion.p
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-20 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-white/75"
              >
                Tap a zone to enter
              </motion.p>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {selectedMeta ? (
              <motion.div
                key={selectedMeta.key}
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10"
              >
                <div className="mx-auto max-w-lg rounded-2xl border border-white/20 bg-black/65 p-4 shadow-2xl backdrop-blur-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{selectedMeta.label}</p>
                      {selectedMeta.sponsor ? (
                        <p className="mt-0.5 text-[11px] text-white/55">
                          {selectedMeta.sponsor.credit || selectedMeta.sponsor.name}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={closeZone}
                      className="shrink-0 rounded-full px-2 py-1 text-xs text-white/55 hover:text-white"
                    >
                      Back
                    </button>
                  </div>

                  <p className="mt-3 text-sm leading-snug text-white/90">{prompt}</p>

                  {snapshot?.window.canContribute ? (
                    <>
                      <label className="sr-only" htmlFor="zone-response">
                        Your response
                      </label>
                      <textarea
                        id="zone-response"
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                        rows={2}
                        maxLength={280}
                        placeholder={placeholder}
                        className="mt-3 w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-white/40 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handlePulse()}
                        disabled={pulsing}
                        className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
                        style={{ background: world.accentColor }}
                      >
                        {pulsing ? "Sending…" : cta}
                      </button>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-white/50">
                      Contributions are closed for now.
                    </p>
                  )}

                  {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {chapterLink && snapshot?.window.mode === "chapter" && !zoomed ? (
            <div className="absolute inset-x-0 bottom-14 z-20 flex justify-center px-4">
              <Link
                href={chapterLink}
                className="rounded-full border border-white/25 bg-black/50 px-4 py-2 text-sm text-white backdrop-blur-md"
              >
                Enter {snapshot.activeChapter?.label || "this show"}
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
          <header className="text-center">
            {world.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={world.logoUrl} alt="" className="mx-auto mb-2 h-8 w-auto opacity-90" />
            ) : null}
            <p
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.3em]"
              style={{ color: world.accentColor, opacity: 0.85 }}
            >
              {snapshot?.brand.title || gardenTitle}
            </p>
            <p className="mt-3 text-sm text-white/70">
              {snapshot?.window.message ?? "Loading the living world…"}
            </p>
          </header>
          {snapshot?.window.canContribute ? (
            <button
              type="button"
              onClick={() => void handlePulse()}
              disabled={pulsing}
              className="mt-8 rounded-xl px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
              style={{ background: world.accentColor }}
            >
              {pulsing ? "Leaving a mark…" : "Leave a mark"}
            </button>
          ) : null}
          {error ? <p className="mt-4 text-center text-sm text-red-300">{error}</p> : null}
        </div>
      )}

      <CelebrationBurst
        active={celebration.active}
        accentColor={world.accentColor}
        message={burstMessage}
      />
    </WorldStage>
  );
}
