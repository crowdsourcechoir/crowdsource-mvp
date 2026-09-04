"use client";

/**
 * Placeholder rows while the blooms list is loading (matches Composer row spacing).
 */
export default function AdminEventsLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-2" aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl border border-transparent bg-transparent px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-6 w-3/5 max-w-md rounded-lg bg-white/10" />
              <div className="h-4 w-2/5 max-w-xs rounded bg-white/5" />
              <div className="h-4 w-full max-w-xl rounded bg-white/5" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-20 rounded-lg bg-white/10" />
              <div className="h-9 w-24 rounded-lg bg-white/10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
