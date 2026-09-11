"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type CameraCaptureShellProps = {
  /** PHOTO or VIDEO label in the bottom dock. */
  modeLabel: "PHOTO" | "VIDEO";
  accentColor: string;
  onClose: () => void;
  /** Full-bleed media (live camera or review clip). */
  media: ReactNode;
  /** Shutter / stop / keep controls — centered in the bottom dock. */
  shutter: ReactNode;
  /** Optional left control (e.g. Retake / Watch). */
  leftAction?: ReactNode;
  /** Optional right control (e.g. flip camera — reserved). */
  rightAction?: ReactNode;
  /** Status line above the shutter (timer, Opening…). */
  status?: ReactNode;
};

/**
 * Full-screen phone-camera style shell for journey photo/video capture.
 * Idle circle CTAs stay on the glass card; once the camera is live we leave
 * the card and give the viewfinder the whole screen.
 */
export default function CameraCaptureShell({
  modeLabel,
  accentColor,
  onClose,
  media,
  shutter,
  leftAction,
  rightAction,
  status,
}: CameraCaptureShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`${modeLabel} capture`}
    >
      {/* Viewfinder */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        {media}

        {/* Top chrome */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/55 to-transparent pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="pointer-events-auto flex items-center justify-between px-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-full px-3 font-mono text-sm text-white/90 [touch-action:manipulation]"
            >
              Cancel
            </button>
            <span
              className="rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{
                color: accentColor,
                background: "rgba(0,0,0,0.45)",
                border: `1px solid color-mix(in srgb, ${accentColor} 45%, transparent)`,
              }}
            >
              {modeLabel}
            </span>
            <span className="w-[64px]" aria-hidden />
          </div>
        </div>
      </div>

      {/* Bottom dock — solid black like a phone camera */}
      <div className="shrink-0 bg-black px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        {status ? (
          <div className="mb-3 text-center font-mono text-xs text-white/80">{status}</div>
        ) : null}
        <div className="grid grid-cols-3 items-center gap-2">
          <div className="flex justify-start">{leftAction}</div>
          <div className="flex flex-col items-center gap-2">
            {shutter}
            <span
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: accentColor }}
            >
              {modeLabel}
            </span>
          </div>
          <div className="flex justify-end">{rightAction}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
