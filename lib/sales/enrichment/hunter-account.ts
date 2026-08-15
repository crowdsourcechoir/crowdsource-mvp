/**
 * Hunter.io account credit balance (Account Information endpoint — free, no credit cost).
 * Never returns the API key.
 */
export type HunterAccountCredits = {
  ok: boolean;
  planName: string | null;
  resetDate: string | null;
  creditsUsed: number | null;
  creditsAvailable: number | null;
  searchesUsed: number | null;
  searchesAvailable: number | null;
  error: string | null;
};

export async function getHunterAccountCredits(): Promise<HunterAccountCredits> {
  const apiKey = process.env.HUNTER_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      planName: null,
      resetDate: null,
      creditsUsed: null,
      creditsAvailable: null,
      searchesUsed: null,
      searchesAvailable: null,
      error: "HUNTER_API_KEY not configured",
    };
  }

  try {
    const url = new URL("https://api.hunter.io/v2/account");
    url.searchParams.set("api_key", apiKey);
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) {
      return {
        ok: false,
        planName: null,
        resetDate: null,
        creditsUsed: null,
        creditsAvailable: null,
        searchesUsed: null,
        searchesAvailable: null,
        error: `Hunter account HTTP ${res.status}`,
      };
    }
    const body = (await res.json()) as {
      data?: {
        plan_name?: string;
        reset_date?: string | number;
        requests?: {
          credits?: { used?: number; available?: number };
          searches?: { used?: number; available?: number };
        };
      };
    };
    const d = body.data;
    return {
      ok: true,
      planName: d?.plan_name ?? null,
      resetDate: d?.reset_date != null ? String(d.reset_date) : null,
      creditsUsed: d?.requests?.credits?.used ?? null,
      creditsAvailable: d?.requests?.credits?.available ?? null,
      searchesUsed: d?.requests?.searches?.used ?? null,
      searchesAvailable: d?.requests?.searches?.available ?? null,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      planName: null,
      resetDate: null,
      creditsUsed: null,
      creditsAvailable: null,
      searchesUsed: null,
      searchesAvailable: null,
      error: err instanceof Error ? err.message : "Hunter account request failed",
    };
  }
}
