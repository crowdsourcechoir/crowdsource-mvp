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
    return worldConfigFromBrand(snapshot.brand, base);
  }, [fallbackEvent, snapshot]);

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

  async function handlePulse() {
    if (!snapshot?.window.canContribute || pulsing) return;
    if ((snapshot.zones?.length ?? 0) > 0 && !selectedZone) {
      setError("Pick a zone on the map first.");
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
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        gardenCelebrationLine?: string | null;
      };
      if (!res.ok) throw new Error(body.error || "Could not leave a mark");
      pulseHaptic();
      setBurstMessage(body.gardenCelebrationLine?.trim() || "You left a mark");
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

  return (
    <WorldStage
      world={world}
      energyLevel={energy}
      celebrationTrigger={celebration.trigger}
      soundtrackUnlocked={unlocked}
      growthNodes={growthNodes}
    >
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
          <h1 className="mt-3 text-2xl font-semibold text-white">Song Garden</h1>
          <p className="mt-2 text-sm text-white/70">
            {snapshot?.window.message ?? "Loading the living world…"}
          </p>
        </header>

        {zones.length > 0 ? (
          <div className="relative mt-6 aspect-[4/5] w-full overflow-hidden rounded-2xl border border-white/15 bg-black/30">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background: `radial-gradient(circle at 50% 40%, ${world.accentColor}33, transparent 55%)`,
              }}
            />
            <p className="absolute left-3 top-3 z-10 font-mono text-[10px] uppercase tracking-widest text-white/50">
              Participation map
            </p>
            {zones.map((z) => {
              const active = selectedZone === z.key;
              const glow = Math.round((z.runtime?.energy ?? 0) * 100);
              return (
                <button
                  key={z.key}
                  type="button"
                  onClick={() => setSelectedZone(z.key)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-1 text-left text-[11px] font-medium text-white shadow-lg backdrop-blur-sm transition"
                  style={{
                    left: `${z.x * 100}%`,
                    top: `${z.y * 100}%`,
                    borderColor: active ? world.accentColor : "rgba(255,255,255,0.25)",
                    background: active ? `${world.accentColor}33` : "rgba(0,0,0,0.55)",
                    boxShadow: active
                      ? `0 0 18px ${world.accentColor}`
                      : glow > 5
                        ? `0 0 ${8 + glow / 8}px ${world.accentColor}66`
                        : undefined,
                  }}
                >
                  <span className="block whitespace-nowrap">{z.label}</span>
                  {z.sponsor ? (
                    <span className="block text-[9px] text-white/55">
                      {z.sponsor.credit || z.sponsor.name}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-md">
          <dl className="grid grid-cols-3 gap-3 text-center text-xs text-white/70">
            <div>
              <dt className="uppercase tracking-wide text-white/40">Energy</dt>
              <dd className="mt-1 font-mono text-base text-white">{energy.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide text-white/40">Marks</dt>
              <dd className="mt-1 font-mono text-base text-white">
                {snapshot?.state.totals.contributions ?? 0}
              </dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide text-white/40">Version</dt>
              <dd className="mt-1 font-mono text-base text-white">
                v{snapshot?.garden.worldVersion ?? 0}
              </dd>
            </div>
          </dl>

          {selectedMeta ? (
            <div className="mt-4 border-t border-white/10 pt-4 text-left text-sm text-white/75">
              <p className="font-medium text-white">{selectedMeta.label}</p>
              {selectedMeta.blurb ? <p className="mt-1 text-white/55">{selectedMeta.blurb}</p> : null}
              <p className="mt-1 font-mono text-xs text-white/45">
                zone energy {(selectedMeta.runtime?.energy ?? 0).toFixed(2)} ·{" "}
                {selectedMeta.runtime?.contributions ?? 0} marks
              </p>
            </div>
          ) : snapshot?.state.landmarks?.length ? (
            <ul className="mt-4 space-y-1 border-t border-white/10 pt-4 text-left text-sm text-white/75">
              {snapshot.state.landmarks.slice(-5).map((lm) => (
                <li key={lm.id}>· {lm.label}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 border-t border-white/10 pt-4 text-sm text-white/50">
              {zones.length ? "Select a zone, then leave a mark." : "Landmarks will open as the garden grows."}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3">
            {snapshot?.window.canContribute ? (
              <button
                type="button"
                onClick={() => void handlePulse()}
                disabled={pulsing}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
                style={{ background: world.accentColor }}
              >
                {pulsing
                  ? "Leaving a mark…"
                  : selectedMeta
                    ? `Leave a mark in ${selectedMeta.label}`
                    : "Leave a mark"}
              </button>
            ) : (
              <p className="text-center text-sm text-white/50">Contributions are closed for now.</p>
            )}
            {chapterLink && snapshot?.window.mode === "chapter" ? (
              <Link
                href={chapterLink}
                className="rounded-xl border border-white/20 px-4 py-3 text-center text-sm text-white hover:bg-white/5"
              >
                Enter {snapshot.activeChapter?.label || "this show"}
              </Link>
            ) : null}
          </div>
        </div>

        {error ? <p className="mt-4 text-center text-sm text-red-300">{error}</p> : null}
      </div>

      <CelebrationBurst
        active={celebration.active}
        accentColor={world.accentColor}
        message={burstMessage}
      />
    </WorldStage>
  );
}
