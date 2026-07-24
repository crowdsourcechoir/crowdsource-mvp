/**
 * Digest volume/quality gates — "email me once I have N leads scoring at least M."
 * Tunable via env so the overnight top-up loop and the email filter stay in sync.
 */

const DEFAULT_MIN_SCORE = 70;
const DEFAULT_TARGET_COUNT = 10;
/** Skip re-sending if a target-meeting digest already landed within this window. */
const DEFAULT_ALREADY_SENT_WINDOW_HOURS = 18;
/** Soft time budget for pipeline/discovery top-up inside one digest cron invocation. */
const DEFAULT_TOPUP_TIME_BUDGET_MS = 4 * 60 * 1000;

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getDigestMinScore(): number {
  return readEnvNumber("SALES_DIGEST_MIN_SCORE", DEFAULT_MIN_SCORE);
}

export function getDigestTargetCount(): number {
  return readEnvInt("SALES_DIGEST_TARGET_COUNT", DEFAULT_TARGET_COUNT);
}

export function getDigestAlreadySentWindowMs(): number {
  return readEnvInt("SALES_DIGEST_ALREADY_SENT_WINDOW_HOURS", DEFAULT_ALREADY_SENT_WINDOW_HOURS) * 60 * 60 * 1000;
}

export function getDigestTopupTimeBudgetMs(): number {
  return readEnvInt("SALES_DIGEST_TOPUP_TIME_BUDGET_MS", DEFAULT_TOPUP_TIME_BUDGET_MS);
}
