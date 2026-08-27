import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let _client: SupabaseClient | null = null;
if (url && serviceRoleKey) {
  _client = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    // Next.js 14 caches `fetch` by default; without this, sales-platform reads can keep
    // serving stale Supabase rows after writes (e.g. queue drafts still saying "I've attached..."
    // after ensure-book-links updated them).
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const timeout = AbortSignal.timeout(8_000);
        const signal =
          init?.signal && typeof AbortSignal.any === "function"
            ? AbortSignal.any([init.signal, timeout])
            : timeout;
        return fetch(input, { ...init, cache: "no-store", signal });
      },
    },
  });
}

export const supabaseAdmin = _client;
