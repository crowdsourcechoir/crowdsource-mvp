"use client";

import { useEffect, useId, useRef, useState } from "react";

export type LibraryTarget =
  | { type: "master" }
  | { type: "garden"; id: string; slug: string; title: string }
  | {
      type: "bloom";
      id: string;
      slug: string;
      title: string;
      gardenId?: string;
      gardenTitle?: string;
    };

export type LibraryGardenNode = {
  id: string;
  slug: string;
  title: string;
  blooms: Array<{ id: string; slug: string; title: string }>;
};

type Props = {
  current: LibraryTarget;
  gardens: LibraryGardenNode[];
  looseBlooms: Array<{ id: string; slug: string; title: string }>;
  onSelect: (target: LibraryTarget) => void;
  loading?: boolean;
};

function pillClass(active: boolean): string {
  return active
    ? "bg-[#CFFF81] text-[#1a1530]"
    : "border border-gray-600 text-gray-300 hover:bg-gray-800";
}

function currentLabel(current: LibraryTarget): string {
  if (current.type === "master") return "Master";
  if (current.type === "garden") return current.title || "Garden";
  if (current.gardenTitle) return `${current.gardenTitle} / ${current.title}`;
  return current.title || "Bloom";
}

function sameTarget(a: LibraryTarget, b: LibraryTarget): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "master") return true;
  if (a.type === "garden" && b.type === "garden") return a.id === b.id || a.slug === b.slug;
  if (a.type === "bloom" && b.type === "bloom") return a.id === b.id || a.slug === b.slug;
  return false;
}

export default function ComposerLibraryPicker({
  current,
  gardens,
  looseBlooms,
  onSelect,
  loading = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const garden of gardens) {
      const isCurrentGarden =
        current.type === "garden" &&
        (current.id === garden.id || current.slug === garden.slug);
      const isCurrentBloom =
        current.type === "bloom" &&
        (current.gardenId === garden.id ||
          garden.blooms.some((b) => b.id === current.id || b.slug === current.slug));
      next[garden.id] = isCurrentGarden || isCurrentBloom || garden.blooms.length <= 4;
    }
    setExpanded(next);
  }, [gardens, current]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(target: LibraryTarget) {
    onSelect(target);
    setOpen(false);
  }

  const label = currentLabel(current);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={loading}
        title={label}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex max-w-[14rem] items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium disabled:opacity-50 ${pillClass(true)}`}
      >
        <span className="truncate">{loading ? "Library…" : label}</span>
        <svg
          viewBox="0 0 12 12"
          className={`h-2.5 w-2.5 shrink-0 opacity-70 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path fill="currentColor" d="M2.2 4.2 6 8l3.8-3.8-.9-.9L6 6.2 3.1 3.3z" />
        </svg>
      </button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label="Composer library"
          className="absolute right-0 z-50 mt-1.5 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/15 bg-[#0c0c0e] shadow-xl shadow-black/50"
        >
          <div className="max-h-72 overflow-y-auto py-1 text-[12px]">
            <button
              type="button"
              role="option"
              aria-selected={current.type === "master"}
              onClick={() => pick({ type: "master" })}
              className={`flex w-full items-center px-3 py-2 text-left hover:bg-white/5 ${
                current.type === "master" ? "text-[#CFFF81]" : "text-gray-200"
              }`}
            >
              Master — all sounds
            </button>

            {gardens.length > 0 ? (
              <div className="my-1 border-t border-white/10" />
            ) : null}

            {gardens.map((garden) => {
              const gardenTarget: LibraryTarget = {
                type: "garden",
                id: garden.id,
                slug: garden.slug,
                title: garden.title,
              };
              const gardenActive = sameTarget(current, gardenTarget);
              const isOpen = expanded[garden.id] ?? true;
              return (
                <div key={garden.id}>
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      role="option"
                      aria-selected={gardenActive}
                      onClick={() => pick(gardenTarget)}
                      className={`min-w-0 flex-1 truncate px-3 py-2 text-left hover:bg-white/5 ${
                        gardenActive ? "text-[#CFFF81]" : "text-gray-200"
                      }`}
                    >
                      {garden.title}
                    </button>
                    {garden.blooms.length > 0 ? (
                      <button
                        type="button"
                        aria-label={isOpen ? "Collapse blooms" : "Expand blooms"}
                        onClick={() =>
                          setExpanded((prev) => ({ ...prev, [garden.id]: !isOpen }))
                        }
                        className="px-2.5 text-gray-500 hover:text-white"
                      >
                        <svg
                          viewBox="0 0 12 12"
                          className={`h-2.5 w-2.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          aria-hidden
                        >
                          <path fill="currentColor" d="M2.2 4.2 6 8l3.8-3.8-.9-.9L6 6.2 3.1 3.3z" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                  {isOpen
                    ? garden.blooms.map((bloom) => {
                        const bloomTarget: LibraryTarget = {
                          type: "bloom",
                          id: bloom.id,
                          slug: bloom.slug,
                          title: bloom.title,
                          gardenId: garden.id,
                          gardenTitle: garden.title,
                        };
                        const active = sameTarget(current, bloomTarget);
                        return (
                          <button
                            key={bloom.id}
                            type="button"
                            role="option"
                            aria-selected={active}
                            onClick={() => pick(bloomTarget)}
                            className={`flex w-full items-center truncate py-1.5 pl-7 pr-3 text-left hover:bg-white/5 ${
                              active ? "text-[#CFFF81]" : "text-gray-400"
                            }`}
                          >
                            {bloom.title}
                          </button>
                        );
                      })
                    : null}
                </div>
              );
            })}

            {looseBlooms.length > 0 ? (
              <>
                <div className="my-1 border-t border-white/10" />
                <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-gray-500">
                  Blooms
                </p>
                {looseBlooms.map((bloom) => {
                  const bloomTarget: LibraryTarget = {
                    type: "bloom",
                    id: bloom.id,
                    slug: bloom.slug,
                    title: bloom.title,
                  };
                  const active = sameTarget(current, bloomTarget);
                  return (
                    <button
                      key={bloom.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => pick(bloomTarget)}
                      className={`flex w-full items-center truncate px-3 py-2 text-left hover:bg-white/5 ${
                        active ? "text-[#CFFF81]" : "text-gray-200"
                      }`}
                    >
                      {bloom.title}
                    </button>
                  );
                })}
              </>
            ) : null}

            {!loading && gardens.length === 0 && looseBlooms.length === 0 ? (
              <p className="px-3 py-2 text-gray-500">No gardens or blooms yet.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
