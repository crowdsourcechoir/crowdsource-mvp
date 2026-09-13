"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFixedMenuPosition } from "@/hooks/useFixedMenuPosition";

type Option<T extends string> = { key: T; label: string; count?: number };

export default function QueueFilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (next: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const menuId = useId();
  const selected = options.find((o) => o.key === value) ?? options[0];
  const placement = useFixedMenuPosition({
    open,
    triggerRef,
    preferredWidth: 240,
    align: "left",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
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
          <ul
            ref={menuRef}
            id={menuId}
            role="listbox"
            className="fixed z-[200] overflow-y-auto overscroll-contain rounded-lg border border-white/15 bg-black py-1 shadow-xl"
            style={{
              top: placement.top,
              left: placement.left,
              width: Math.max(placement.width, triggerRef.current?.offsetWidth ?? 0),
              maxHeight: placement.maxHeight,
            }}
          >
            {options.map((opt) => {
              const active = opt.key === value;
              return (
                <li key={opt.key} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={`flex w-full min-w-0 items-center justify-between gap-3 px-3 py-1.5 text-left text-xs transition-colors ${
                      active
                        ? "bg-[var(--csc-accent)]/15 text-[var(--csc-accent)]"
                        : "text-gray-200 hover:bg-[var(--csc-accent)]/10 hover:text-white"
                    }`}
                    onClick={() => {
                      onChange(opt.key);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 truncate">{opt.label}</span>
                    {opt.count != null ? (
                      <span className="shrink-0 text-gray-500">{opt.count}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-full items-center gap-2 rounded-lg border border-white/15 bg-black px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:border-[var(--csc-accent)] hover:text-white sm:max-w-[14rem]"
      >
        <span className="shrink-0 truncate text-gray-500">{label}</span>
        <span className="min-w-0 truncate text-white">{selected?.label ?? "All"}</span>
        {selected?.count != null ? (
          <span className="shrink-0 text-gray-500">{selected.count}</span>
        ) : null}
        <span className="shrink-0 text-gray-500" aria-hidden>
          ▾
        </span>
      </button>
      {menu}
    </div>
  );
}
