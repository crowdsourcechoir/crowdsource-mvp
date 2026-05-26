import { createHash } from "crypto";

export const SONGGARDEN_GUEST_COOLDOWN_MS = 2_000;
export const SONGGARDEN_RETURNING_COOLDOWN_MS = 1_000;

const DAY_MS = 24 * 60 * 60 * 1000;

export type SonggardenSubmissionRecord = {
  submittedAt: string;
  deviceId?: string | null;
  sessionToken?: string | null;
  ipHash?: string | null;
};

export function hashClientIp(ip: string | null | undefined): string | null {
  const trimmed = ip?.split(",")[0]?.trim();
  if (!trimmed) return null;
  return createHash("sha256").update(`songgarden:${trimmed}`).digest("hex").slice(0, 32);
}

export function getRequestClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip")?.trim() ?? null;
}

export type SonggardenRateLimitResult =
  | { ok: true; remaining: number; isReturning: boolean }
  | { ok: false; error: string; retryAfterMs?: number };

export function checkSonggardenRateLimit(args: {
  eventId: string;
  deviceId: string;
  sessionToken: string | null;
  ipHash: string | null;
  recent: SonggardenSubmissionRecord[];
}): SonggardenRateLimitResult {
  const now = Date.now();
  const dayAgo = now - DAY_MS;

  const forEvent = args.recent.filter((r) => {
    const t = new Date(r.submittedAt).getTime();
    return Number.isFinite(t);
  });

  const deviceDay = forEvent.filter(
    (r) => r.deviceId === args.deviceId && new Date(r.submittedAt).getTime() > dayAgo
  );

  const isReturning =
    !!args.sessionToken &&
    forEvent.some((r) => r.sessionToken === args.sessionToken);

  const cooldownMs = isReturning ? SONGGARDEN_RETURNING_COOLDOWN_MS : SONGGARDEN_GUEST_COOLDOWN_MS;

  const lastDevice = deviceDay[0];
  if (lastDevice) {
    const elapsed = now - new Date(lastDevice.submittedAt).getTime();
    if (elapsed < cooldownMs) {
      const retryAfterMs = cooldownMs - elapsed;
      return {
        ok: false,
        error: `Please wait ${Math.ceil(retryAfterMs / 1000)}s before dropping another sound.`,
        retryAfterMs,
      };
    }
  }

  return {
    ok: true,
    remaining: 999,
    isReturning,
  };
}
