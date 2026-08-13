"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { ZoneHitRegion } from "@/lib/song-garden-v2/garden/types";
import { zoneHitRegion } from "@/lib/song-garden-v2/garden/types";
import LoopingVideo from "@/components/song-garden-v2/LoopingVideo";

export type EditableZonePin = {
  key: string;
  label: string;
  x: number;
  y: number;
  hit?: ZoneHitRegion | null;
};

type Props = {
  mapImageUrl: string;
  /** When set, zones are authored over the ambient loop (same plane fans see). */
  mapVideoUrl?: string | null;
  zones: EditableZonePin[];
  accentColor?: string;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  onMove: (key: string, x: number, y: number) => void;
  onHitChange: (key: string, hit: ZoneHitRegion | null) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function clamp01(n: number) {
  return Math.max(0.02, Math.min(0.98, n));
}

type Tool = "pan" | "label" | "circle" | "polygon";
type Camera = { focusX: number; focusY: number; scale: number };

const OVERVIEW_SCALE = 1;
const EDIT_SCALE = 1.65;
const DRAG_SLOP = 8;

/**
 * Visual zone placer for Fans maps.
 * Drag the map to explore (same model as public /g). Place labels / hit regions
 * in full map-frame space so they stay locked when the ambient loop plays.
 */
export default function ZoneMapEditor({
  mapImageUrl,
  mapVideoUrl = null,
  zones,
  accentColor = "#CFFF81",
  selectedKey = null,
  onSelect,
  onMove,
  onHitChange,
}: Props) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [tool, setTool] = useState<Tool>("pan");
  const [mapAspect, setMapAspect] = useState(16 / 9);
  const [viewport, setViewport] = useState({ w: 280, h: 400 });
  const [camera, setCamera] = useState<Camera>({
    focusX: 0.5,
    focusY: 0.5,
    scale: OVERVIEW_SCALE,
  });
  const cameraRef = useRef(camera);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originFocusX: number;
    originFocusY: number;
    moved: boolean;
    mode: "pan" | "label";
    key: string | null;
  } | null>(null);

  const selected = zones.find((z) => z.key === selectedKey) ?? null;
  const selectedHit = selected ? zoneHitRegion(selected) : null;

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    const measure = () => {
      const el = surfaceRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setViewport({ w: r.width || 280, h: r.height || 400 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const mapSize = useMemo(() => {
    const coverW = Math.max(viewport.w, viewport.h * mapAspect);
    const coverH = coverW / mapAspect;
    return { w: coverW, h: coverH };
  }, [viewport.w, viewport.h, mapAspect]);

  const clientToMapPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = surfaceRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const vx = clientX - rect.left;
      const vy = clientY - rect.top;
      const cam = cameraRef.current;
      const mapX = cam.focusX + (vx - rect.width / 2) / (mapSize.w * cam.scale);
      const mapY = cam.focusY + (vy - rect.height / 2) / (mapSize.h * cam.scale);
      return { x: clamp01(mapX), y: clamp01(mapY) };
    },
    [mapSize.w, mapSize.h]
  );

  const focusForZone = useCallback((x: number, y: number, scale: number) => {
    const pad = 0.5 / scale;
    return {
      focusX: clamp(x, pad, 1 - pad),
      focusY: clamp(y, pad, 1 - pad),
      scale,
    };
  }, []);

  const onPinPointerDown = (key: string, e: ReactPointerEvent<HTMLButtonElement>) => {
    if (tool !== "label") return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(key);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originFocusX: cameraRef.current.focusX,
      originFocusY: cameraRef.current.focusY,
      moved: false,
      mode: "label",
      key,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPinPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.mode !== "label" || d.pointerId !== e.pointerId || !d.key) return;
    const p = clientToMapPoint(e.clientX, e.clientY);
    if (!p) return;
    d.moved = true;
    onMove(d.key, p.x, p.y);
  };

  const onPinPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.mode === "label") {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      dragRef.current = null;
    }
  };

  const onSurfacePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (tool === "pan" || tool === "label") {
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originFocusX: cameraRef.current.focusX,
        originFocusY: cameraRef.current.focusY,
        moved: false,
        mode: "pan",
        key: null,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (!selectedKey || !selected) return;
    const p = clientToMapPoint(e.clientX, e.clientY);
    if (!p) return;

    if (tool === "circle") {
      const r =
        selected.hit?.type === "circle"
          ? selected.hit.r
          : zoneHitRegion(selected).type === "circle"
            ? (zoneHitRegion(selected) as { type: "circle"; r: number }).r
            : 0.08;
      onMove(selectedKey, p.x, p.y);
      onHitChange(selectedKey, { type: "circle", r });
      return;
    }

    if (tool === "polygon") {
      const prev = selected.hit?.type === "polygon" ? selected.hit.points : [];
      onHitChange(selectedKey, { type: "polygon", points: [...prev, p] });
    }
  };

  const onSurfacePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.mode !== "pan" || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > DRAG_SLOP) d.moved = true;
    const scale = cameraRef.current.scale;
    const nextX = d.originFocusX - dx / (mapSize.w * scale);
    const nextY = d.originFocusY - dy / (mapSize.h * scale);
    const pad = 0.5 / scale;
    setCamera((prev) => ({
      ...prev,
      focusX: clamp(nextX, pad, 1 - pad),
      focusY: clamp(nextY, pad, 1 - pad),
    }));
  };

  const onSurfacePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.mode !== "pan" || d.pointerId !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current = null;
  };

  const translateX = (0.5 - camera.focusX) * mapSize.w * camera.scale;
  const translateY = (0.5 - camera.focusY) * mapSize.h * camera.scale;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Drag the map to explore — same as fans on{" "}
        <code className="text-gray-400">/g</code>. Zones ride the map plane (and the ambient
        loop when present), not a moving camera inside the video.
      </p>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["pan", "Pan map"],
            ["label", "Move label"],
            ["circle", "Circle hit area"],
            ["polygon", "Draw polygon"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTool(id)}
            className={`rounded-full px-3 py-1.5 text-xs ${
              tool === id
                ? "bg-[#CFFF81] font-semibold text-black"
                : "border border-gray-700 text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="rounded-full border border-gray-700 px-3 py-1.5 text-xs text-gray-300"
          onClick={() => setCamera({ focusX: 0.5, focusY: 0.5, scale: OVERVIEW_SCALE })}
        >
          Overview
        </button>
        {selected ? (
          <button
            type="button"
            className="rounded-full border border-gray-700 px-3 py-1.5 text-xs text-gray-300"
            onClick={() => setCamera(focusForZone(selected.x, selected.y, EDIT_SCALE))}
          >
            Zoom to zone
          </button>
        ) : null}
      </div>

      {selected && tool === "circle" ? (
        <label className="block text-xs text-gray-400">
          Hit radius
          <input
            type="range"
            min={0.03}
            max={0.28}
            step={0.005}
            className="mt-1 w-full"
            value={selectedHit?.type === "circle" ? selectedHit.r : 0.08}
            onChange={(e) => {
              const r = Number(e.target.value);
              onHitChange(selected.key, { type: "circle", r });
            }}
          />
        </label>
      ) : null}

      {selected && tool === "polygon" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300"
            onClick={() => onHitChange(selected.key, null)}
          >
            Clear polygon
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300"
            onClick={() => {
              if (selected.hit?.type !== "polygon" || selected.hit.points.length === 0) return;
              onHitChange(selected.key, {
                type: "polygon",
                points: selected.hit.points.slice(0, -1),
              });
            }}
          >
            Undo point
          </button>
          <p className="self-center text-[11px] text-gray-500">
            Tap map to add points (3+). Fans tap inside the shape.
          </p>
        </div>
      ) : null}

      <div
        ref={surfaceRef}
        className="relative mx-auto w-full overflow-hidden rounded-xl border border-gray-700 bg-black touch-none"
        style={{
          aspectRatio: "9 / 16",
          maxHeight: "min(60dvh, 520px)",
          maxWidth: "min(100%, 300px)",
          cursor: tool === "pan" || tool === "label" ? "grab" : "crosshair",
        }}
        onPointerDown={onSurfacePointerDown}
        onPointerMove={onSurfacePointerMove}
        onPointerUp={onSurfacePointerUp}
        onPointerCancel={onSurfacePointerUp}
      >
        <div
          className="absolute left-1/2 top-1/2 will-change-transform"
          style={{
            width: mapSize.w,
            height: mapSize.h,
            marginLeft: -mapSize.w / 2,
            marginTop: -mapSize.h / 2,
            transform: `translate(${translateX}px, ${translateY}px) scale(${camera.scale})`,
          }}
        >
          <div className="relative h-full w-full">
            {mapVideoUrl ? (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <LoopingVideo
                  src={mapVideoUrl}
                  poster={mapImageUrl}
                  veilColor="#0a0a0a"
                  objectFit="fill"
                  onMediaSize={(w, h) => {
                    if (w > 0 && h > 0) setMapAspect(w / h);
                  }}
                />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mapImageUrl}
                alt=""
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full object-fill select-none"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    setMapAspect(img.naturalWidth / img.naturalHeight);
                  }
                }}
              />
            )}

            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
            >
              {zones.map((z) => {
                const hit = zoneHitRegion(z);
                const active = selectedKey === z.key;
                const fill = active ? `${accentColor}55` : "rgba(207,255,129,0.18)";
                const stroke = active ? accentColor : "rgba(255,255,255,0.35)";
                if (hit.type === "circle") {
                  return (
                    <circle
                      key={z.key}
                      cx={z.x}
                      cy={z.y}
                      r={hit.r}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={0.008}
                    />
                  );
                }
                const d =
                  hit.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ") + " Z";
                return (
                  <path
                    key={z.key}
                    d={d}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={0.008}
                  />
                );
              })}
            </svg>

            {zones.map((z) => {
              const active = selectedKey === z.key;
              return (
                <button
                  key={z.key}
                  type="button"
                  onPointerDown={(e) => onPinPointerDown(z.key, e)}
                  onPointerMove={onPinPointerMove}
                  onPointerUp={onPinPointerUp}
                  onPointerCancel={onPinPointerUp}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect?.(z.key);
                  }}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border px-2 py-1 text-[10px] font-medium shadow-lg"
                  style={{
                    left: `${z.x * 100}%`,
                    top: `${z.y * 100}%`,
                    borderColor: active ? accentColor : "rgba(255,255,255,0.4)",
                    background: active ? accentColor : "rgba(0,0,0,0.8)",
                    color: active ? "#0a0a0a" : "#fff",
                    cursor: tool === "label" ? "grab" : "pointer",
                  }}
                >
                  {z.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedKey ? (
        <p className="font-mono text-[11px] text-gray-500">
          Selected{" "}
          <span className="text-gray-300">{selected?.label ?? selectedKey}</span>
          {selectedHit?.type === "circle"
            ? ` · circle r=${selectedHit.r.toFixed(3)}`
            : selectedHit?.type === "polygon"
              ? ` · polygon ${selectedHit.points.length} pts`
              : ""}
        </p>
      ) : (
        <p className="text-[11px] text-gray-600">
          Select a zone, pan to find it, then draw its clickable region.
        </p>
      )}
    </div>
  );
}
