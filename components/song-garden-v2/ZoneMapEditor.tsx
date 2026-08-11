"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ZoneHitRegion } from "@/lib/song-garden-v2/garden/types";
import { zoneHitRegion } from "@/lib/song-garden-v2/garden/types";

export type EditableZonePin = {
  key: string;
  label: string;
  x: number;
  y: number;
  hit?: ZoneHitRegion | null;
};

type Props = {
  mapImageUrl: string;
  zones: EditableZonePin[];
  accentColor?: string;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  onMove: (key: string, x: number, y: number) => void;
  onHitChange: (key: string, hit: ZoneHitRegion | null) => void;
};

function clamp01(n: number) {
  return Math.max(0.02, Math.min(0.98, n));
}

type Tool = "label" | "circle" | "polygon";

/**
 * Visual zone placer for Fans maps.
 * - Label: drag the bubble anchor
 * - Circle / polygon: author the clickable painted region fans tap
 */
export default function ZoneMapEditor({
  mapImageUrl,
  zones,
  accentColor = "#CFFF81",
  selectedKey = null,
  onSelect,
  onMove,
  onHitChange,
}: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragKey = useRef<string | null>(null);
  const [tool, setTool] = useState<Tool>("circle");

  const selected = zones.find((z) => z.key === selectedKey) ?? null;
  const selectedHit = selected ? zoneHitRegion(selected) : null;

  const pointFromEvent = useCallback((clientX: number, clientY: number) => {
    const el = boxRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  }, []);

  const onPinPointerDown = (key: string, e: ReactPointerEvent<HTMLButtonElement>) => {
    if (tool !== "label") return;
    e.preventDefault();
    e.stopPropagation();
    dragKey.current = key;
    onSelect?.(key);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPinPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (tool !== "label" || !dragKey.current) return;
    const p = pointFromEvent(e.clientX, e.clientY);
    if (!p) return;
    onMove(dragKey.current, p.x, p.y);
  };

  const onPinPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragKey.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    dragKey.current = null;
  };

  const onMapPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!selectedKey || !selected) return;
    const p = pointFromEvent(e.clientX, e.clientY);
    if (!p) return;

    if (tool === "label") {
      onMove(selectedKey, p.x, p.y);
      return;
    }

    if (tool === "circle") {
      // Place circle center at tap; keep current radius (or default).
      const r =
        selected.hit?.type === "circle" ? selected.hit.r : zoneHitRegion(selected).type === "circle"
          ? (zoneHitRegion(selected) as { type: "circle"; r: number }).r
          : 0.08;
      onMove(selectedKey, p.x, p.y);
      onHitChange(selectedKey, { type: "circle", r });
      return;
    }

    if (tool === "polygon") {
      const prev =
        selected.hit?.type === "polygon"
          ? selected.hit.points
          : [];
      onHitChange(selectedKey, { type: "polygon", points: [...prev, p] });
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Author the <span className="text-gray-300">clickable painted zone</span> fans tap — not just
        the label bubble. Use the phone frame so placement matches the public world.
      </p>

      <div className="flex flex-wrap gap-2">
        {(
          [
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
          <p className="text-[11px] text-gray-500 self-center">
            Tap map to add points (3+). Fans tap inside the shape.
          </p>
        </div>
      ) : null}

      <div
        className="relative mx-auto w-full overflow-hidden rounded-xl border border-gray-700 bg-black"
        style={{
          aspectRatio: "9 / 16",
          maxHeight: "min(60dvh, 480px)",
          maxWidth: "min(100%, 280px)",
        }}
        ref={boxRef}
        onPointerDown={onMapPointerDown}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mapImageUrl}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />

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
            const d = hit.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ") + " Z";
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
        <p className="text-[11px] text-gray-600">Select a zone, then draw its clickable region.</p>
      )}
    </div>
  );
}
