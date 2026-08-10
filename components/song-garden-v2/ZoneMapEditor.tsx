"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export type EditableZonePin = {
  key: string;
  label: string;
  x: number;
  y: number;
};

type Props = {
  mapImageUrl: string;
  zones: EditableZonePin[];
  accentColor?: string;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  onMove: (key: string, x: number, y: number) => void;
};

function clamp01(n: number) {
  return Math.max(0.02, Math.min(0.98, n));
}

/**
 * Visual zone placer — drag pins on the real map image (object-contain).
 * Coordinates are 0..1 relative to the image box, matching the public /g map.
 */
export default function ZoneMapEditor({
  mapImageUrl,
  zones,
  accentColor = "#CFFF81",
  selectedKey = null,
  onSelect,
  onMove,
}: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [aspect, setAspect] = useState(1600 / 1102);
  const dragKey = useRef<string | null>(null);

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

  const onPointerDown = (key: string, e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragKey.current = key;
    onSelect?.(key);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragKey.current) return;
    const p = pointFromEvent(e.clientX, e.clientY);
    if (!p) return;
    onMove(dragKey.current, p.x, p.y);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragKey.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    dragKey.current = null;
  };

  const onBackgroundClick = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!selectedKey) return;
    // Ignore when starting a drag on a pin (pins stopPropagation).
    const p = pointFromEvent(e.clientX, e.clientY);
    if (!p) return;
    onMove(selectedKey, p.x, p.y);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        Drag a zone pin to line it up with the map. Tap the map to nudge the selected zone.
      </p>
      <div
        className="relative mx-auto w-full overflow-hidden rounded-xl border border-gray-700 bg-black"
        style={{
          aspectRatio: String(aspect),
          maxHeight: "min(55dvh, 420px)",
          maxWidth: `min(100%, calc(min(55dvh, 420px) * ${aspect}))`,
        }}
        ref={boxRef}
        onPointerDown={onBackgroundClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mapImageUrl}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              setAspect(img.naturalWidth / img.naturalHeight);
            }
          }}
        />
        {zones.map((z) => {
          const active = selectedKey === z.key;
          return (
            <button
              key={z.key}
              type="button"
              onPointerDown={(e) => onPointerDown(z.key, e)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border px-2 py-1 text-[10px] font-medium shadow-lg"
              style={{
                left: `${z.x * 100}%`,
                top: `${z.y * 100}%`,
                borderColor: active ? accentColor : "rgba(255,255,255,0.4)",
                background: active ? accentColor : "rgba(0,0,0,0.8)",
                color: active ? "#0a0a0a" : "#fff",
                cursor: "grab",
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
          <span className="text-gray-300">
            {zones.find((z) => z.key === selectedKey)?.label ?? selectedKey}
          </span>{" "}
          · x {(zones.find((z) => z.key === selectedKey)?.x ?? 0).toFixed(3)} · y{" "}
          {(zones.find((z) => z.key === selectedKey)?.y ?? 0).toFixed(3)}
        </p>
      ) : (
        <p className="text-[11px] text-gray-600">Select a zone pin to edit its spot.</p>
      )}
    </div>
  );
}
