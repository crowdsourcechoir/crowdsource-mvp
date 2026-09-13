"use client";

import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from "react";

export type FixedMenuPlacement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

type Options = {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  /** Preferred menu width in px (clamped to viewport). */
  preferredWidth?: number;
  /** Align menu to the trigger's right edge (default) or left. */
  align?: "left" | "right";
  gap?: number;
  viewportPad?: number;
};

/**
 * Positions a portaled menu with `position: fixed` so AdminShell's
 * `overflow-auto` main cannot clip it on narrow phones.
 */
export function useFixedMenuPosition({
  open,
  triggerRef,
  preferredWidth = 272,
  align = "right",
  gap = 4,
  viewportPad = 8,
}: Options): FixedMenuPlacement | null {
  const [placement, setPlacement] = useState<FixedMenuPlacement | null>(null);

  const update = useCallback(() => {
    const trigger = triggerRef.current;
    if (!open || !trigger) {
      setPlacement(null);
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const vv = window.visualViewport;
    const viewLeft = vv?.offsetLeft ?? 0;
    const viewTop = vv?.offsetTop ?? 0;
    const viewWidth = vv?.width ?? window.innerWidth;
    const viewHeight = vv?.height ?? window.innerHeight;

    const safeLeft = viewLeft + viewportPad;
    const safeRight = viewLeft + viewWidth - viewportPad;
    const availableWidth = Math.max(160, safeRight - safeLeft);
    const width = Math.min(preferredWidth, availableWidth);

    let left = align === "right" ? rect.right - width : rect.left;
    left = Math.min(Math.max(left, safeLeft), safeRight - width);

    const spaceBelow = viewTop + viewHeight - rect.bottom - gap - viewportPad;
    const spaceAbove = rect.top - viewTop - gap - viewportPad;
    const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(140, Math.min(320, preferBelow ? spaceBelow : spaceAbove));

    const top = preferBelow
      ? rect.bottom + gap
      : Math.max(viewTop + viewportPad, rect.top - gap - maxHeight);

    setPlacement({ top, left, width, maxHeight });
  }, [align, gap, open, preferredWidth, triggerRef, viewportPad]);

  useLayoutEffect(() => {
    update();
  }, [update]);

  useEffect(() => {
    if (!open) return;
    function onReposition() {
      update();
    }
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    window.visualViewport?.addEventListener("resize", onReposition);
    window.visualViewport?.addEventListener("scroll", onReposition);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      window.visualViewport?.removeEventListener("resize", onReposition);
      window.visualViewport?.removeEventListener("scroll", onReposition);
    };
  }, [open, update]);

  return open ? placement : null;
}
