"use client";

/**
 * Placeholder cards while the events list is loading.
 */
export default function AdminEventsLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 sm:space-y-5" aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-6 w-3/5 max-w-md rounded-lg bg-gray-800" />
              <div className="h-4 w-2/5 max-w-xs rounded bg-gray-800/80" />
              <div className="h-4 w-full max-w-xl rounded bg-gray-800/60" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-20 rounded-lg bg-gray-800" />
              <div className="h-9 w-24 rounded-lg bg-gray-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
