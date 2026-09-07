"use client";

import { useEffect, useId, useRef, useState } from "react";

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
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected = options.find((o) => o.key === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[14rem] items-center gap-2 rounded-lg border border-white/15 bg-black px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:border-[var(--csc-accent)] hover:text-white"
      >
        <span className="truncate text-gray-500">{label}</span>
        <span className="truncate text-white">{selected?.label ?? "All"}</span>
        {selected?.count != null ? (
          <span className="text-gray-500">{selected.count}</span>
        ) : null}
        <span className="text-gray-500" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <ul
          id={menuId}
          role="listbox"
          className="absolute left-0 z-30 mt-1 min-w-full overflow-hidden rounded-lg border border-white/15 bg-black py-1 shadow-xl"
        >
          {options.map((opt) => {
            const active = opt.key === value;
            return (
              <li key={opt.key} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs transition-colors ${
                    active
                      ? "bg-[var(--csc-accent)]/15 text-[var(--csc-accent)]"
                      : "text-gray-200 hover:bg-[var(--csc-accent)]/10 hover:text-white"
                  }`}
                  onClick={() => {
                    onChange(opt.key);
                    setOpen(false);
                  }}
                >
                  <span>{opt.label}</span>
                  {opt.count != null ? <span className="text-gray-500">{opt.count}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
