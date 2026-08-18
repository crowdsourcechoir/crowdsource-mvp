/**
 * Deterministic extraction of "follow up later" timing from reply text.
 * Used when Gmail sync records a reply so "circle back in a few months" can
 * pre-populate opportunities.next_follow_up_at without inventing a date.
 */

import { addDaysIso, addMonthsIso } from "../gmail/constants";

export type FollowUpPreset = "1w" | "2w" | "1m" | "3m" | "6m";

export const FOLLOW_UP_PRESETS: { id: FollowUpPreset; label: string; days?: number; months?: number }[] = [
  { id: "1w", label: "1 week", days: 7 },
  { id: "2w", label: "2 weeks", days: 14 },
  { id: "1m", label: "1 month", months: 1 },
  { id: "3m", label: "3 months", months: 3 },
  { id: "6m", label: "6 months", months: 6 },
];

export type ExtractedFollowUp = {
  followUpAt: string;
  /** Human-readable match, e.g. "in a few months" */
  matchedText: string;
  /** How confident the parse is — "high" for explicit N units, "medium" for vague phrases */
  confidence: "high" | "medium";
};

const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
};

function parseCount(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 && n <= 36 ? n : null;
  }
  return WORD_NUMBERS[trimmed] ?? null;
}

/** Resolve a UI/API preset to an ISO timestamp from now (or a given anchor). */
export function followUpAtFromPreset(preset: FollowUpPreset, fromIso: string = new Date().toISOString()): string {
  const def = FOLLOW_UP_PRESETS.find((p) => p.id === preset);
  if (!def) throw new Error(`Unknown follow-up preset "${preset}"`);
  if (def.days != null) return addDaysIso(fromIso, def.days);
  if (def.months != null) return addMonthsIso(fromIso, def.months);
  throw new Error(`Preset "${preset}" has no duration`);
}

/**
 * Parse natural-language follow-up timing from an email snippet/body.
 * Returns null when nothing actionable is found (caller should clear/leave next_follow_up_at).
 */
export function extractFollowUpFromText(
  text: string | null | undefined,
  fromIso: string = new Date().toISOString()
): ExtractedFollowUp | null {
  if (!text?.trim()) return null;
  const normalized = text.replace(/\s+/g, " ").trim();

  // "in a few months" / "in a couple of weeks" — common soft deferrals
  const vague = normalized.match(/\b(?:in\s+)?(?:a\s+)?(few|couple(?:\s+of)?)\s+(days?|weeks?|months?)\b/i);
  if (vague) {
    const amountWord = vague[1].toLowerCase();
    const unit = vague[2].toLowerCase();
    const n = amountWord.startsWith("couple") ? 2 : unit.startsWith("day") ? 10 : unit.startsWith("week") ? 3 : 3;
    const followUpAt = unit.startsWith("month")
      ? addMonthsIso(fromIso, n)
      : addDaysIso(fromIso, unit.startsWith("week") ? n * 7 : n);
    return { followUpAt, matchedText: vague[0].trim(), confidence: "medium" };
  }

  // "in 3 months" / "in two weeks"
  const numeric = normalized.match(
    /\bin\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(days?|weeks?|months?)\b/i
  );
  if (numeric) {
    const n = parseCount(numeric[1]);
    if (n != null) {
      const unit = numeric[2].toLowerCase();
      const followUpAt = unit.startsWith("month")
        ? addMonthsIso(fromIso, n)
        : addDaysIso(fromIso, unit.startsWith("week") ? n * 7 : n);
      return { followUpAt, matchedText: numeric[0].trim(), confidence: "high" };
    }
  }

  // "next quarter" / "next year"
  if (/\bnext\s+quarter\b/i.test(normalized)) {
    return { followUpAt: addMonthsIso(fromIso, 3), matchedText: "next quarter", confidence: "medium" };
  }
  if (/\bnext\s+year\b/i.test(normalized)) {
    return { followUpAt: addMonthsIso(fromIso, 12), matchedText: "next year", confidence: "medium" };
  }

  // Seasonal — approximate mid-season of the next upcoming occurrence
  const season = normalized.match(/\b(?:in\s+|next\s+)?(spring|summer|fall|autumn|winter)\b/i);
  if (season) {
    const name = season[1].toLowerCase();
    const targetMonth = name === "spring" ? 3 : name === "summer" ? 6 : name === "winter" ? 11 : 9; // 0-indexed: Apr/Jul/Oct/Dec
    const d = new Date(fromIso);
    const year = d.getUTCFullYear();
    let candidate = new Date(Date.UTC(year, targetMonth, 15, 15, 0, 0));
    if (candidate.getTime() <= d.getTime() + 14 * 24 * 60 * 60 * 1000) {
      candidate = new Date(Date.UTC(year + 1, targetMonth, 15, 15, 0, 0));
    }
    return { followUpAt: candidate.toISOString(), matchedText: season[0].trim(), confidence: "medium" };
  }

  return null;
}
