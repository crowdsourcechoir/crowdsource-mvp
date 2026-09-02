const HUNTER_VERIFIER_URL = "https://api.hunter.io/v2/email-verifier";
const FETCH_TIMEOUT_MS = 25000;
const POLL_202_MS = 2000;
const MAX_202_ATTEMPTS = 5;

export type HunterVerifierStatus = "valid" | "invalid" | "accept_all" | "webmail" | "disposable" | "unknown";

export type HunterVerifierResult = {
  ok: boolean;
  email: string;
  status: HunterVerifierStatus | null;
  score: number | null;
  smtpCheck: boolean | null;
  acceptAll: boolean | null;
  disposable: boolean | null;
  gibberish: boolean | null;
  mxRecords: boolean | null;
  error: string | null;
  httpStatus: number | null;
};

/**
 * Hunter Email Verifier — 0.5 credit per completed verification; unknown/failed checks are free.
 * HTTP 202 means still running; we poll the same URL (Hunter counts that as one request).
 */
export async function verifyWithHunter(email: string): Promise<HunterVerifierResult> {
  const apiKey = process.env.HUNTER_API_KEY?.trim();
  const normalized = email.trim().toLowerCase();
  const empty = (error: string, httpStatus: number | null = null): HunterVerifierResult => ({
    ok: false,
    email: normalized,
    status: null,
    score: null,
    smtpCheck: null,
    acceptAll: null,
    disposable: null,
    gibberish: null,
    mxRecords: null,
    error,
    httpStatus,
  });

  if (!apiKey) return empty("HUNTER_API_KEY is missing.");
  if (!normalized.includes("@")) return empty("Not an email address.", 400);

  const url = new URL(HUNTER_VERIFIER_URL);
  url.searchParams.set("email", normalized);
  url.searchParams.set("api_key", apiKey);

  for (let attempt = 0; attempt < MAX_202_ATTEMPTS; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      clearTimeout(timeout);

      if (res.status === 202) {
        await sleep(POLL_202_MS);
        continue;
      }
      if (res.status === 451) {
        return {
          ok: true,
          email: normalized,
          status: "invalid",
          score: 0,
          smtpCheck: false,
          acceptAll: false,
          disposable: false,
          gibberish: false,
          mxRecords: null,
          error: null,
          httpStatus: 451,
        };
      }
      if (!res.ok) {
        return empty(`Hunter verifier HTTP ${res.status}`, res.status);
      }

      const body = (await res.json()) as {
        data?: {
          status?: string;
          score?: number;
          smtp_check?: boolean;
          accept_all?: boolean;
          disposable?: boolean;
          gibberish?: boolean;
          mx_records?: boolean;
        };
      };
      const d = body.data ?? {};
      const status = normalizeHunterStatus(d.status);
      return {
        ok: true,
        email: normalized,
        status,
        score: typeof d.score === "number" ? d.score : null,
        smtpCheck: typeof d.smtp_check === "boolean" ? d.smtp_check : null,
        acceptAll: typeof d.accept_all === "boolean" ? d.accept_all : null,
        disposable: typeof d.disposable === "boolean" ? d.disposable : null,
        gibberish: typeof d.gibberish === "boolean" ? d.gibberish : null,
        mxRecords: typeof d.mx_records === "boolean" ? d.mx_records : null,
        error: null,
        httpStatus: res.status,
      };
    } catch (err) {
      return empty(err instanceof Error ? err.message : "Hunter verifier failed");
    }
  }

  return empty("Hunter verifier timed out (still running).", 202);
}

function normalizeHunterStatus(value: string | undefined): HunterVerifierStatus | null {
  if (
    value === "valid" ||
    value === "invalid" ||
    value === "accept_all" ||
    value === "webmail" ||
    value === "disposable" ||
    value === "unknown"
  ) {
    return value;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
