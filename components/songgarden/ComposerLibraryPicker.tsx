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

const GROUP_LABEL_CLASS =
  "px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-gray-500";

function rowClass(active: boolean, muted = false): string {
  const base =
    "flex w-full items-center gap-2 rounded-lg text-left text-xs transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--csc-accent)]/60";
  if (active) return `${base} bg-[var(--csc-accent)]/15 text-[var(--csc-accent)]`;
  return `${base} ${muted ? "text-gray-400" : "text-gray-200"} hover:bg-[var(--csc-accent)]/10 hover:text-white`;
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
        className="inline-flex max-w-[16rem] items-center gap-2 rounded-lg border border-white/15 bg-black px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:border-[var(--csc-accent)] hover:text-white disabled:opacity-50"
      >
        <span className="shrink-0 text-gray-500">Library</span>
        <span className="truncate text-white">{loading ? "…" : label}</span>
        <span className="text-gray-500" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label="Composer library"
          className="absolute right-0 z-50 mt-1 w-[min(17rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-white/15 bg-black shadow-xl"
        >
          <div className="max-h-72 overflow-y-auto py-1 text-xs">
            <button
              type="button"
              role="option"
              aria-selected={current.type === "master"}
              onClick={() => pick({ type: "master" })}
              className={`${rowClass(current.type === "master")} px-3 py-1.5 font-medium`}
            >
              <span className="truncate">Master — all sounds</span>
            </button>

            {gardens.length > 0 ? (
              <>
                <div className="mx-2 my-1 border-t border-white/10" />
                <p className={GROUP_LABEL_CLASS}>Song Gardens</p>
              </>
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
                  <div className="flex items-stretch gap-0.5">
                    <button
                      type="button"
                      role="option"
                      aria-selected={gardenActive}
                      onClick={() => pick(gardenTarget)}
                      className={`${rowClass(gardenActive)} min-w-0 flex-1 px-3 py-1.5 font-medium`}
                    >
                      <span className="truncate">{garden.title}</span>
                    </button>
                    {garden.blooms.length > 0 ? (
                      <button
                        type="button"
                        aria-label={isOpen ? "Collapse blooms" : "Expand blooms"}
                        onClick={() =>
                          setExpanded((prev) => ({ ...prev, [garden.id]: !isOpen }))
                        }
                        className="rounded-lg px-2 text-gray-500 transition-colors hover:bg-[var(--csc-accent)]/10 hover:text-[var(--csc-accent)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--csc-accent)]/60"
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
                            className={`${rowClass(active, true)} py-1.5 pl-3 pr-3`}
                          >
                            <span
                              className={`ml-1 h-3 w-px shrink-0 ${
                                active ? "bg-[var(--csc-accent)]" : "bg-white/15"
                              }`}
                              aria-hidden
                            />
                            <span className="truncate">{bloom.title}</span>
                          </button>
                        );
                      })
                    : null}
                </div>
              );
            })}

            {looseBlooms.length > 0 ? (
              <>
                <div className="mx-2 mt-1 border-t border-white/10" />
                <p className={GROUP_LABEL_CLASS}>Blooms</p>
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
                      className={`${rowClass(active)} px-3 py-1.5`}
                    >
                      <span className="truncate">{bloom.title}</span>
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
