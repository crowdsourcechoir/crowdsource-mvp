"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFixedMenuPosition } from "@/hooks/useFixedMenuPosition";

type Props = {
  /** What is being removed — shown in the confirm step. */
  kindLabel: string;
  disabled?: boolean;
  onDelete: () => Promise<void>;
};

/**
 * Three-dot menu on one Composer contribution.
 * Delete is a second step so a mis-tap does not remove the asset.
 */
export default function ContributionActionsMenu({ kindLabel, disabled, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const placement = useFixedMenuPosition({
    open,
    triggerRef,
    preferredWidth: confirming ? 240 : 160,
    align: "right",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setConfirming(false);
      setError(null);
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

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }

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
                  Delete this {kindLabel}? This cannot be undone.
                </p>
                {error ? <p className="text-[11px] text-rose-400">{error}</p> : null}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    className="rounded-lg px-2 py-1 text-xs text-gray-300 hover:text-white disabled:opacity-50"
                    onClick={() => {
                      setConfirming(false);
                      setError(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    className="rounded-lg border border-red-500/50 px-2 py-1 text-xs font-medium text-red-200 hover:border-red-400 hover:text-red-100 disabled:opacity-50"
                    onClick={() => void confirmDelete()}
                  >
                    {busy ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                role="menuitem"
                className="flex w-full px-3 py-1.5 text-left text-xs text-red-200 transition-colors hover:bg-red-500/10 hover:text-red-100"
                onClick={() => setConfirming(true)}
              >
                Delete
              </button>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="csc-btn-circle text-base leading-none text-gray-300"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Actions for this ${kindLabel}`}
        disabled={disabled || busy}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span aria-hidden>⋯</span>
      </button>
      {menu}
    </div>
  );
}
