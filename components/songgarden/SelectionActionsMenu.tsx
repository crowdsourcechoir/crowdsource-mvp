"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFixedMenuPosition } from "@/hooks/useFixedMenuPosition";
import { selectionActionLabel } from "@/lib/composer/selection-export";

type Props = {
  soundCount: number;
  mediaCount: number;
  busy?: boolean;
  error?: string | null;
  onExport: () => Promise<void>;
  onDelete: () => Promise<void>;
};

/** Actions for the current Composer selection: export or delete. */
export default function SelectionActionsMenu({
  soundCount,
  mediaCount,
  busy,
  error,
  onExport,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const placement = useFixedMenuPosition({
    open,
    triggerRef,
    preferredWidth: confirming ? 260 : 180,
    align: "right",
  });
  const total = soundCount + mediaCount;
  const label = selectionActionLabel(soundCount, mediaCount);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setConfirming(false);
      return;
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu =
    open && placement && mounted
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            className="fixed z-[200] overflow-hidden rounded-lg border border-white/15 bg-black py-1 shadow-xl"
            style={{
              top: placement.top,
              left: placement.left,
              width: placement.width,
              maxHeight: placement.maxHeight,
            }}
          >
            {confirming ? (
              <div className="space-y-2 px-3 py-2">
                <p className="text-xs leading-snug text-gray-200">
                  Delete {label}? This cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-lg px-2 py-1 text-xs text-gray-300 hover:text-white disabled:opacity-50"
                    onClick={() => setConfirming(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-lg border border-red-500/50 px-2 py-1 text-xs font-medium text-red-200 hover:border-red-400 hover:text-red-100 disabled:opacity-50"
                    onClick={() => {
                      setOpen(false);
                      void onDelete();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  className="flex w-full px-3 py-1.5 text-left text-xs text-gray-200 transition-colors hover:bg-[var(--csc-accent)]/10 hover:text-white disabled:opacity-40"
                  onClick={() => {
                    setOpen(false);
                    void onExport();
                  }}
                >
                  Export selected
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  className="flex w-full px-3 py-1.5 text-left text-xs text-red-200 transition-colors hover:bg-red-500/10 hover:text-red-100 disabled:opacity-40"
                  onClick={() => setConfirming(true)}
                >
                  Delete selected
                </button>
              </>
            )}
          </div>,
          document.body
        )
      : null;

  if (total === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:border-[var(--csc-accent)] hover:text-white disabled:opacity-50"
      >
        <span className="text-gray-500">Actions</span>
        <span className="text-white">{busy ? "Working…" : label}</span>
        <span className="text-gray-500" aria-hidden>
          ▾
        </span>
      </button>
      {menu}
      {error ? <p className="mt-1 max-w-xs text-[11px] text-rose-400">{error}</p> : null}
    </div>
  );
}
