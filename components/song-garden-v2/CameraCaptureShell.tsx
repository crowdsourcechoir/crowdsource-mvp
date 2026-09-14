"use client";

import type { ReactNode } from "react";

/** Shared portrait frame for journey capture + Composer (iPhone-ish 9:16). */
export const PORTRAIT_MEDIA_ASPECT_CLASS = "aspect-[9/16]";

type CameraCaptureShellProps = {
  /** PHOTO or VIDEO label in the chrome. */
  modeLabel: "PHOTO" | "VIDEO";
  accentColor: string;
  onClose: () => void;
  /** Live camera or review media — fills the card viewfinder. */
  media: ReactNode;
  /** Shutter / stop / keep controls — centered in the bottom dock. */
  shutter: ReactNode;
  /** Optional left control (e.g. Retake). */
  leftAction?: ReactNode;
  /** Optional right control (reserved). */
  rightAction?: ReactNode;
  /** Status line above the shutter (timer, Opening…). */
  status?: ReactNode;
};

/**
 * In-card portrait capture frame for journey photo/video.
 * Stays inside the glass prompt card so the garden background, logo, and
 * card outline remain — no full-screen black portal.
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
  return (
    <div
      className={[
        // Fill the glass card width; card border is the media outline.
        "relative w-full overflow-hidden",
        PORTRAIT_MEDIA_ASPECT_CLASS,
        "max-h-[min(72dvh,760px)]",
      ].join(" ")}
      role="group"
      aria-label={`${modeLabel} capture`}
    >
      {/* Viewfinder — clipped by the parent glass card’s rounded outline when flush */}
      <div className="absolute inset-0 bg-black/25">
        <div className="absolute inset-0">{media}</div>
      </div>

      {/* Top chrome */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/50 via-black/20 to-transparent pb-12 pt-3">
        <div className="pointer-events-auto flex items-center justify-between px-3 sm:px-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-full px-2 font-mono text-sm text-white/95 [touch-action:manipulation]"
          >
            Cancel
          </button>
          <span
            className="rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{
              color: accentColor,
              background: "rgba(0,0,0,0.35)",
              border: `1px solid color-mix(in srgb, ${accentColor} 45%, transparent)`,
            }}
          >
            {modeLabel}
          </span>
          <span className="w-[56px]" aria-hidden />
        </div>
      </div>

      {/* Bottom dock — translucent so the card/garden still read */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/65 via-black/35 to-transparent px-3 pb-4 pt-14 sm:px-4 sm:pb-5">
        {status ? (
          <div className="mb-3 text-center font-mono text-xs text-white/85">{status}</div>
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
    </div>
  );
}
