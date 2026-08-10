"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
      if (!selectedZone && data.zones?.length === 1) {
        setSelectedZone(data.zones[0].key);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [gardenSlug, selectedZone]);

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
    // Venue / stadium maps belong on the zone card — not as full-bleed stage art.
    return { ...merged, heroArtworkUrl: null };
  }, [fallbackEvent, snapshot]);

  const mapArtworkUrl = snapshot?.brand.heroArtworkUrl ?? null;

  const growthNodes = useMemo((): WorldGrowthNode[] => {
    if (!snapshot) return [];
    const shared = snapshot.state.field.nodes.map((n) => ({
      id: `shared_${n.id}`,
      kind: n.kind as ContributionKind,
      index: n.index,
      createdAt: Date.parse(n.createdAt) || Date.now(),
      emphasis: "shared" as const,
    }));
    const personal = snapshot.myMarks.map((m) => ({
      id: `mark_${m.id}`,
      kind: m.kind as ContributionKind,
      index: m.index,
      createdAt: Date.parse(m.createdAt) || Date.now(),
      emphasis: "personal" as const,
    }));
    return [...shared, ...personal];
  }, [snapshot]);

  function selectZone(key: string) {
    setSelectedZone(key);
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
  const prompt =
    selectedMeta?.prompt?.trim() ||
    selectedMeta?.blurb?.trim() ||
    "Leave a mark in this zone.";
  const cta =
    selectedMeta?.ctaLabel?.trim() ||
    (selectedMeta ? `Leave a mark in ${selectedMeta.label}` : "Leave a mark");
  const placeholder =
    selectedMeta?.inputPlaceholder?.trim() || "Type your response…";

  return (
    <WorldStage
      world={world}
      energyLevel={energy}
      celebrationTrigger={celebration.trigger}
      soundtrackUnlocked={unlocked}
      growthNodes={growthNodes}
    >
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-3 px-1">
          <div className="min-w-0 text-left">
            {world.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={world.logoUrl} alt="" className="mb-1 h-7 w-auto opacity-90" />
            ) : null}
            <p
              className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.28em]"
              style={{ color: world.accentColor, opacity: 0.9 }}
            >
              {snapshot?.brand.title || gardenTitle}
            </p>
          </div>
          <div className="shrink-0 rounded-full border border-white/15 bg-black/45 px-3 py-1 font-mono text-[11px] text-white/80 backdrop-blur-sm">
            {energy.toFixed(2)} · {snapshot?.state.totals.contributions ?? 0} marks
          </div>
        </header>

        {zones.length > 0 ? (
          <div className="relative mt-3 w-full">
            <div
              className="relative mx-auto w-full overflow-hidden rounded-2xl border border-white/15 bg-black/40"
              style={{
                aspectRatio: String(mapAspect),
                maxHeight: "min(52dvh, 420px)",
                maxWidth: `min(100%, calc(min(52dvh, 420px) * ${mapAspect}))`,
              }}
            >
              {mapArtworkUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mapArtworkUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-contain"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                      setMapAspect(img.naturalWidth / img.naturalHeight);
                    }
                  }}
                />
              ) : (
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    background: `radial-gradient(circle at 50% 40%, ${world.accentColor}33, transparent 55%)`,
                  }}
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

              {!selectedMeta ? (
                <p className="absolute left-3 right-3 top-3 z-10 text-center font-mono text-[10px] uppercase tracking-widest text-white/80">
                  Tap a zone to engage
                </p>
              ) : null}

              {zones.map((z) => {
                const active = selectedZone === z.key;
                const glow = Math.round((z.runtime?.energy ?? 0) * 100);
                return (
                  <button
                    key={z.key}
                    type="button"
                    onClick={() => selectZone(z.key)}
                    className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border px-2.5 py-1.5 text-left text-[11px] font-medium text-white shadow-lg backdrop-blur-sm transition"
                    style={{
                      left: `${z.x * 100}%`,
                      top: `${z.y * 100}%`,
                      borderColor: active ? world.accentColor : "rgba(255,255,255,0.35)",
                      background: active ? `${world.accentColor}cc` : "rgba(0,0,0,0.72)",
                      color: active ? "#0a0a0a" : "#fff",
                      boxShadow: active
                        ? `0 0 18px ${world.accentColor}`
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

            {/* Prompt sheet sits under the map so the map keeps its true aspect */}
            {selectedMeta ? (
              <div className="mt-3 rounded-2xl border border-white/20 bg-black/75 p-4 shadow-xl backdrop-blur-md">
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
                    onClick={() => {
                      setSelectedZone(null);
                      setResponse("");
                    }}
                    className="shrink-0 rounded-full px-2 py-1 text-xs text-white/50 hover:text-white"
                    aria-label="Close zone"
                  >
                    Close
                  </button>
                </div>

                <p className="mt-3 text-sm leading-snug text-white/85">{prompt}</p>

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
                  <p className="mt-3 text-sm text-white/50">Contributions are closed for now.</p>
                )}

                <p className="mt-2 font-mono text-[10px] text-white/40">
                  {selectedMeta.runtime?.contributions ?? 0} marks here · energy{" "}
                  {(selectedMeta.runtime?.energy ?? 0).toFixed(2)}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-md">
            <p className="text-sm text-white/60">
              {snapshot?.window.message ?? "Loading the living world…"}
            </p>
            {snapshot?.window.canContribute ? (
              <button
                type="button"
                onClick={() => void handlePulse()}
                disabled={pulsing}
                className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
                style={{ background: world.accentColor }}
              >
                {pulsing ? "Leaving a mark…" : "Leave a mark"}
              </button>
            ) : null}
          </div>
        )}

        {chapterLink && snapshot?.window.mode === "chapter" ? (
          <Link
            href={chapterLink}
            className="mt-3 rounded-xl border border-white/20 px-4 py-3 text-center text-sm text-white hover:bg-white/5"
          >
            Enter {snapshot.activeChapter?.label || "this show"}
          </Link>
        ) : null}

        {error ? <p className="mt-3 text-center text-sm text-red-300">{error}</p> : null}
      </div>

      <CelebrationBurst
        active={celebration.active}
        accentColor={world.accentColor}
        message={burstMessage}
      />
    </WorldStage>
  );
}
