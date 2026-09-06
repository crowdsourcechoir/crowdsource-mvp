"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { getOrCreateSonggardenDeviceId } from "@/data/songgardenClient";
import type { ContributionKind, GardenSnapshot } from "@/lib/song-garden-v2/garden/types";
import {
  pointInZoneHit,
  resolveMapPlateStillUrl,
  resolveMapPlateVideoUrl,
  zoneHitRegion,
} from "@/lib/song-garden-v2/garden/types";
import { worldConfigFromBrand } from "@/lib/song-garden-v2/garden/snapshot";
import { resolveWorldConfig } from "@/lib/song-garden-v2/world-config";
import type { WorldGrowthNode } from "@/lib/song-garden-v2/growth-nodes";
import WorldStage from "@/components/song-garden-v2/WorldStage";
import BrandOverlayLayer from "@/components/song-garden-v2/BrandOverlayLayer";
import LoopingVideo from "@/components/song-garden-v2/LoopingVideo";
import CelebrationBurst from "@/components/song-garden-v2/CelebrationBurst";
import { useCelebration } from "@/components/song-garden-v2/engine/useCelebration";
import { pulseHaptic } from "@/lib/song-garden-v2/haptics";

type Props = {
  gardenSlug: string;
  gardenTitle: string;
};

const POLL_MS = 25_000;
const OVERVIEW_SCALE = 1;
const ZONE_SCALE = 2.35;
/** Focus sits a bit above center so the prompt sheet doesn't cover the zone. */
const FOCUS_Y_OFFSET = 0.12;
const DRAG_CLICK_SLOP = 10;

type Camera = { focusX: number; focusY: number; scale: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function GardenPresenceClient({ gardenSlug, gardenTitle }: Props) {
  const [snapshot, setSnapshot] = useState<GardenSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [burstMessage, setBurstMessage] = useState("The garden stirred");
  const [unlocked, setUnlocked] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [mapAspect, setMapAspect] = useState(1600 / 1102);
  const [camera, setCamera] = useState<Camera>({
    focusX: 0.5,
    focusY: 0.5,
    scale: OVERVIEW_SCALE,
  });
  const [viewport, setViewport] = useState({ w: 390, h: 844 });
  const celebration = useCelebration();

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef(camera);
  const selectedRef = useRef(selectedZone);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originFocusX: number;
    originFocusY: number;
    moved: boolean;
    lastX: number;
    lastY: number;
  } | null>(null);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);
  useEffect(() => {
    selectedRef.current = selectedZone;
  }, [selectedZone]);

  useEffect(() => {
    const measure = () => {
      const el = surfaceRef.current;
      if (!el) {
        setViewport({ w: window.innerWidth, h: window.innerHeight });
        return;
      }
      const r = el.getBoundingClientRect();
      setViewport({ w: r.width || window.innerWidth, h: r.height || window.innerHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

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

  const mapArtworkUrl = snapshot ? resolveMapPlateStillUrl(snapshot.brand) : null;
  const mapVideoUrl = snapshot ? resolveMapPlateVideoUrl(snapshot.brand) : null;

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

  const zones = snapshot?.zones ?? [];

  /** Spatial order for swipe: left→right, then top→bottom. */
  const zoneOrder = useMemo(
    () =>
      [...zones].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x)).map((z) => z.key),
    [zones]
  );

  const mapSize = useMemo(() => {
    const coverW = Math.max(viewport.w, viewport.h * mapAspect);
    const coverH = coverW / mapAspect;
    return { w: coverW, h: coverH };
  }, [viewport.w, viewport.h, mapAspect]);

  const focusForZone = useCallback((x: number, y: number, scale: number) => {
    // Keep focus in a safe band so zoomed edges aren't empty.
    const pad = 0.5 / scale;
    return {
      focusX: clamp(x, pad, 1 - pad),
      focusY: clamp(y - FOCUS_Y_OFFSET / scale, pad, 1 - pad),
      scale,
    };
  }, []);

  const goOverview = useCallback(() => {
    setCamera({ focusX: 0.5, focusY: 0.5, scale: OVERVIEW_SCALE });
  }, []);

  const selectZone = useCallback(
    (key: string) => {
      const z = zones.find((row) => row.key === key);
      if (!z) return;
      setUnlocked(true);
      setSelectedZone(key);
      setResponse("");
      setError(null);
      setCamera(focusForZone(z.x, z.y, ZONE_SCALE));
    },
    [zones, focusForZone]
  );

  const closeZone = useCallback(() => {
    setSelectedZone(null);
    setResponse("");
    setError(null);
    goOverview();
  }, [goOverview]);

  const stepZone = useCallback(
    (dir: -1 | 1) => {
      if (!zoneOrder.length) return;
      const cur = selectedRef.current;
      const idx = cur ? zoneOrder.indexOf(cur) : -1;
      const nextIdx =
        idx < 0 ? (dir > 0 ? 0 : zoneOrder.length - 1) : (idx + dir + zoneOrder.length) % zoneOrder.length;
      selectZone(zoneOrder[nextIdx]);
    },
    [zoneOrder, selectZone]
  );

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
        goOverview();
        void refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pulse failed");
    } finally {
      setPulsing(false);
    }
  }

  const clientToMapPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = surfaceRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const vx = clientX - rect.left;
      const vy = clientY - rect.top;
      const cam = cameraRef.current;
      // Inverse of: screen = center + (mapPoint - focus) * mapSize * scale
      const mapX = cam.focusX + (vx - rect.width / 2) / (mapSize.w * cam.scale);
      const mapY = cam.focusY + (vy - rect.height / 2) / (mapSize.h * cam.scale);
      return { x: mapX, y: mapY };
    },
    [mapSize.w, mapSize.h]
  );

  const zoneAtPoint = useCallback(
    (px: number, py: number) => {
      // Prefer smallest containing region so nested/overlapping areas resolve cleanly.
      const hits = zones.filter((z) => pointInZoneHit(px, py, z));
      if (!hits.length) return null;
      hits.sort((a, b) => {
        const ha = zoneHitRegion(a);
        const hb = zoneHitRegion(b);
        const area = (h: ReturnType<typeof zoneHitRegion>, z: { x: number; y: number }) => {
          if (h.type === "circle") return Math.PI * h.r * h.r;
          // rough polygon bbox area
          const xs = h.points.map((p) => p.x);
          const ys = h.points.map((p) => p.y);
          return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
        };
        return area(ha, a) - area(hb, b);
      });
      return hits[0];
    },
    [zones]
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Ignore multi-touch / UI chrome; only primary pointer on the map surface.
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originFocusX: cameraRef.current.focusX,
      originFocusY: cameraRef.current.focusY,
      moved: false,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > DRAG_CLICK_SLOP) d.moved = true;
    d.lastX = e.clientX;
    d.lastY = e.clientY;

    const scale = cameraRef.current.scale;
    // Dragging the map moves the world under the finger (grab to pan).
    const nextX = d.originFocusX - dx / (mapSize.w * scale);
    const nextY = d.originFocusY - dy / (mapSize.h * scale);
    const pad = 0.5 / scale;
    setCamera((prev) => ({
      ...prev,
      focusX: clamp(nextX, pad, 1 - pad),
      focusY: clamp(nextY, pad, 1 - pad),
    }));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    // Tap the painted zone (not the bubble) to enter it.
    // Horizontal swipe no longer jumps zones — that fought pan-to-explore on phones.
    if (!d.moved) {
      const p = clientToMapPoint(d.lastX, d.lastY);
      if (p) {
        const hit = zoneAtPoint(p.x, p.y);
        if (hit) selectZone(hit.key);
      }
    }

    dragRef.current = null;
  };

  const energy = snapshot?.state.energy ?? 0;
  const chapterLink = snapshot?.activeChapter?.eventSlug
    ? `/e/${snapshot.activeChapter.eventSlug}`
    : null;
  const selectedMeta = zones.find((z) => z.key === selectedZone) ?? null;
  const zoomed = Boolean(selectedMeta);
  const zoneIsJourney =
    selectedMeta?.engageMode === "journey" && Boolean(selectedMeta.journeyEventSlug);
  const journeyHref =
    zoneIsJourney && selectedMeta?.journeyEventSlug
      ? `/e/${selectedMeta.journeyEventSlug}?fromGarden=${encodeURIComponent(gardenSlug)}&zone=${encodeURIComponent(selectedMeta.key)}`
      : null;
  const prompt =
    selectedMeta?.prompt?.trim() ||
    selectedMeta?.blurb?.trim() ||
    (zoneIsJourney ? "A journey starts here." : "Leave a mark in this zone.");
  const cta =
    selectedMeta?.ctaLabel?.trim() ||
    (zoneIsJourney
      ? "Enter the journey"
      : selectedMeta
        ? `Leave a mark in ${selectedMeta.label}`
        : "Leave a mark");
  const placeholder =
    selectedMeta?.inputPlaceholder?.trim() || "Type your response…";

  // Translate so focus point sits at viewport center.
  const translateX = (0.5 - camera.focusX) * mapSize.w * camera.scale;
  const translateY = (0.5 - camera.focusY) * mapSize.h * camera.scale;

  return (
    <WorldStage
      world={world}
      energyLevel={energy}
      celebrationTrigger={celebration.trigger}
      soundtrackUnlocked={unlocked}
      growthNodes={growthNodes}
    >
      {snapshot ? <BrandOverlayLayer brand={snapshot.brand} /> : null}
      {zones.length > 0 && mapArtworkUrl ? (
        <div
          ref={surfaceRef}
          className="relative z-10 h-[100dvh] max-h-[100dvh] w-full touch-none overflow-hidden overscroll-none"
        >
          {/* Grabbable map world — drag to pan, tap a painted zone to engage */}
          <div
            className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <motion.div
              className="absolute left-1/2 top-1/2 will-change-transform"
              animate={{
                x: translateX,
                y: translateY,
                scale: camera.scale,
              }}
              transition={{ type: "spring", stiffness: 260, damping: 32, mass: 0.85 }}
              style={{
                width: mapSize.w,
                height: mapSize.h,
                marginLeft: -mapSize.w / 2,
                marginTop: -mapSize.h / 2,
              }}
            >
              <div className="relative h-full w-full">
                {mapVideoUrl ? (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <LoopingVideo
                      src={mapVideoUrl}
                      poster={mapArtworkUrl ?? undefined}
                      veilColor={world.primaryColor}
                    />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mapArtworkUrl}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                        setMapAspect(img.naturalWidth / img.naturalHeight);
                      }
                    }}
                  />
                )}
                {/* Hidden img keeps aspect ratio when video is active */}
                {mapVideoUrl && mapArtworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mapArtworkUrl}
                    alt=""
                    className="pointer-events-none absolute h-0 w-0 opacity-0"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                        setMapAspect(img.naturalWidth / img.naturalHeight);
                      }
                    }}
                  />
                ) : null}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: zoomed
                      ? "radial-gradient(circle at center, transparent 18%, rgba(0,0,0,0.45) 92%)"
                      : "linear-gradient(to top, rgba(0,0,0,0.4), transparent 45%, rgba(0,0,0,0.25))",
                  }}
                />

                {/* Clickable painted regions — energy glow scales with zone vitality (M3) */}
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox="0 0 1 1"
                  preserveAspectRatio="none"
                >
                  {zones.map((z) => {
                    const hit = zoneHitRegion(z);
                    const active = selectedZone === z.key;
                    const zoneEnergy = Math.min(1, Math.max(0, z.runtime?.energy ?? 0));
                    const glow = 0.06 + zoneEnergy * 0.42;
                    const fill = active
                      ? `${world.accentColor}66`
                      : `${world.accentColor}${Math.round(glow * 255)
                          .toString(16)
                          .padStart(2, "0")}`;
                    const stroke = active
                      ? world.accentColor
                      : zoneEnergy > 0.08
                        ? `${world.accentColor}99`
                        : "rgba(255,255,255,0.22)";
                    const pulseR =
                      hit.type === "circle" ? hit.r * (1 + zoneEnergy * 0.12) : null;
                    if (hit.type === "circle") {
                      return (
                        <g key={z.key}>
                          {zoneEnergy > 0.05 ? (
                            <circle
                              cx={z.x}
                              cy={z.y}
                              r={(pulseR ?? hit.r) * 1.35}
                              fill={`${world.accentColor}14`}
                              className="origin-center"
                              style={{
                                animation: `garden-zone-pulse ${2.4 - zoneEnergy}s ease-in-out infinite`,
                              }}
                            />
                          ) : null}
                          <circle
                            cx={z.x}
                            cy={z.y}
                            r={pulseR ?? hit.r}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={0.004}
                          />
                        </g>
                      );
                    }
                    const d =
                      hit.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ") +
                      " Z";
                    return (
                      <path
                        key={z.key}
                        d={d}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={0.004}
                      />
                    );
                  })}
                </svg>

                {/* Labels — sponsor mark + name + CTA teaser (not the hit target) */}
                {zones.map((z) => {
                  const active = selectedZone === z.key;
                  const logo = z.logoUrl || z.sponsor?.logoUrl || null;
                  const teaser =
                    z.ctaLabel?.trim() ||
                    (z.engageMode === "journey"
                      ? "Enter journey"
                      : null) ||
                    z.blurb?.trim() ||
                    (z.prompt?.trim()
                      ? z.prompt.trim().length > 42
                        ? `${z.prompt.trim().slice(0, 40)}…`
                        : z.prompt.trim()
                      : null);
                  const initial = (z.sponsor?.name || z.label || "?").trim().charAt(0).toUpperCase();
                  return (
                    <div
                      key={z.key}
                      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: `${z.x * 100}%`,
                        top: `${z.y * 100}%`,
                        opacity: zoomed && !active ? 0.28 : 1,
                      }}
                    >
                      <div
                        className="flex max-w-[11.5rem] items-center gap-1.5 rounded-2xl border px-1.5 py-1 shadow-lg backdrop-blur-md sm:max-w-[13rem]"
                        style={{
                          borderColor: active ? world.accentColor : "rgba(255,255,255,0.35)",
                          background: active ? `${world.accentColor}e6` : "rgba(0,0,0,0.78)",
                          color: active ? "#0a0a0a" : "#fff",
                        }}
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
                          style={{
                            borderColor: active ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.2)",
                            background: active ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.08)",
                          }}
                        >
                          {logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logo} alt="" className="h-full w-full object-contain p-0.5" />
                          ) : (
                            <span
                              className="font-mono text-[11px] font-bold"
                              style={{ color: active ? "#0a0a0a" : world.accentColor }}
                            >
                              {initial}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 pr-1">
                          <p className="truncate text-[11px] font-semibold leading-tight sm:text-xs">
                            {z.label}
                          </p>
                          {teaser ? (
                            <p
                              className="mt-0.5 truncate text-[9px] font-medium leading-tight sm:text-[10px]"
                              style={{ opacity: active ? 0.75 : 0.7 }}
                            >
                              {teaser}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>

          {/* Top chrome: logo left · eyebrow center · energy right */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 grid grid-cols-[1fr_auto_1fr] items-start gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
            <div className="pointer-events-auto min-w-0 justify-self-start">
              <p
                className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.28em] drop-shadow"
                style={{ color: world.accentColor }}
              >
                {snapshot?.brand.title || gardenTitle}
              </p>
            </div>
            <div className="pointer-events-none max-w-[11rem] justify-self-center px-1 text-center sm:max-w-[14rem]">
              <p
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] drop-shadow sm:text-[11px]"
                style={{ color: world.accentColor }}
              >
                {snapshot?.brand.title || gardenTitle}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-medium text-white/80 drop-shadow">
                {zoomed && selectedMeta
                  ? selectedMeta.label
                  : snapshot?.brand.mapPlate?.seasonLabel?.trim() || "Tap a zone to engage"}
              </p>
            </div>
            <div className="pointer-events-auto flex shrink-0 items-center justify-end gap-2 justify-self-end">
              {zoomed ? (
                <div className="flex overflow-hidden rounded-full border border-white/15 bg-black/50 backdrop-blur-md">
                  <button
                    type="button"
                    aria-label="Previous zone"
                    onClick={() => stepZone(-1)}
                    className="px-3 py-1.5 text-sm text-white/85"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Next zone"
                    onClick={() => stepZone(1)}
                    className="border-l border-white/15 px-3 py-1.5 text-sm text-white/85"
                  >
                    ›
                  </button>
                </div>
              ) : null}
              <div className="rounded-full border border-white/15 bg-black/50 px-3 py-1 font-mono text-[11px] text-white/85 backdrop-blur-md">
                {energy.toFixed(2)} · {snapshot?.state.totals.contributions ?? 0}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {!zoomed ? (
              <motion.p
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 px-4 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-white/75 sm:text-[11px]"
              >
                Drag to explore · tap a zone to engage
              </motion.p>
            ) : null}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {selectedMeta ? (
              <motion.div
                key={selectedMeta.key}
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 18 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-8"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="mx-auto max-w-lg rounded-2xl border border-white/20 bg-black/70 p-3.5 shadow-2xl backdrop-blur-md sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      {selectedMeta.logoUrl || selectedMeta.sponsor?.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedMeta.logoUrl || selectedMeta.sponsor?.logoUrl || ""}
                          alt=""
                          className="mt-0.5 h-9 w-9 shrink-0 rounded-md border border-white/15 bg-white/5 object-contain p-1"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{selectedMeta.label}</p>
                        {selectedMeta.sponsor ? (
                          <p className="mt-0.5 text-[11px] text-white/55">
                            {selectedMeta.sponsor.credit || selectedMeta.sponsor.name}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeZone}
                      className="shrink-0 rounded-full px-2 py-1 text-xs text-white/55 hover:text-white"
                    >
                      Map
                    </button>
                  </div>

                  <p className="mt-2.5 text-sm leading-snug text-white/90 sm:mt-3">{prompt}</p>

                  {journeyHref ? (
                    <Link
                      href={journeyHref}
                      className="mt-2.5 flex min-h-[48px] w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-black sm:mt-3"
                      style={{ background: world.accentColor }}
                    >
                      {cta}
                    </Link>
                  ) : snapshot?.window.canContribute ? (
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
                        className="mt-2.5 w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-base text-white placeholder:text-white/35 focus:border-white/40 focus:outline-none sm:mt-3 sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => void handlePulse()}
                        disabled={pulsing}
                        className="mt-2.5 min-h-[48px] w-full rounded-xl px-4 py-3 text-sm font-semibold text-black disabled:opacity-50 sm:mt-3"
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

                  <p className="mt-2 text-center font-mono text-[10px] text-white/40">
                    Tap Map to explore other zones
                  </p>

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
              className="mt-8 min-h-[48px] rounded-xl px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
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
