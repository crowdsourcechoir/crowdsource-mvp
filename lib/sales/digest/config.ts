/**
 * Solid-lead bar — shared by the morning digest, the approval queue gate, and
 * pipeline skip-below-threshold logic. Tunable via SALES_DIGEST_MIN_SCORE.
 */

const DEFAULT_MIN_SCORE = 70;
const DEFAULT_TARGET_COUNT = 10;
/** Skip re-sending if a target-meeting digest already landed within this window. */
const DEFAULT_ALREADY_SENT_WINDOW_HOURS = 18;
/** Soft time budget for pipeline/discovery/near-miss top-up inside one digest cron invocation. */
const DEFAULT_TOPUP_TIME_BUDGET_MS = 5 * 60 * 1000;

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

/** Minimum totalScore for a lead to be considered solid (default 70). */
export function getMinLeadScore(): number {
  return readEnvNumber("SALES_DIGEST_MIN_SCORE", DEFAULT_MIN_SCORE);
}

/** @deprecated Prefer getMinLeadScore — kept so digest call sites stay readable. */
export function getDigestMinScore(): number {
  return getMinLeadScore();
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
