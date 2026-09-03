/** CDN-friendly cache for public participant reads (event config, activity, snapshots). */

/** Event slug JSON — admin edits may take up to ~60s to appear at the edge. */
export const PUBLIC_EVENT_CACHE = "public, s-maxage=60, stale-while-revalidate=300";

/** Aggregate activity counts — safe to cache briefly under load. */
export const PUBLIC_ACTIVITY_CACHE = "public, s-maxage=15, stale-while-revalidate=45";

/** Garden snapshot — versioned; short TTL with SWR. */
export const PUBLIC_SNAPSHOT_CACHE = "public, s-maxage=5, stale-while-revalidate=20";

export const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;
