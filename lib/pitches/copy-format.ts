import type { CopyBlock, PitchPoint } from "@/app/sobeca-song-garden/content";

/** Squarespace lightAccent on crowdsourcechoir.com — the brush under “undeniable”. */
export const BRUSH_COLOR = "#6105F5";

export const TEXT_STYLES = ["kicker", "title", "heading", "line", "large", "paragraph"] as const;
export type TextStyle = (typeof TEXT_STYLES)[number];

export function isTextStyle(type: string): type is TextStyle {
  return (TEXT_STYLES as readonly string[]).includes(type);
}

export type CopyRun = { text: string; bold: boolean; underline: boolean };

const MARK = /\*\*([^*]+)\*\*|\{\{([^}]+)\}\}/g;

function plain(text: string): CopyRun {
  return { text, bold: false, underline: false };
}

/** Turn `**bold**` and `{{brush}}` plus saved phrases into runs the deck can render. */
export function parseCopyRuns(
  text: string,
  marks?: { bold?: string[]; underline?: true | string | false }
): CopyRun[] {
  const runs: CopyRun[] = [];
  const pattern = new RegExp(MARK.source, "g");
  let match: RegExpExecArray | null = pattern.exec(text);
  let cursor = 0;
  while (match) {
    const index = match.index;
    if (index > cursor) runs.push(plain(text.slice(cursor, index)));
    if (match[1]) runs.push({ text: match[1], bold: true, underline: false });
    else if (match[2]) runs.push({ text: match[2], bold: false, underline: true });
    cursor = index + match[0].length;
    match = pattern.exec(text);
  }
  if (cursor < text.length || runs.length === 0) runs.push(plain(text.slice(cursor)));

  let next = runs.filter((run) => run.text.length > 0);
  if (next.length === 0) next = [plain("")];
  const phrase = typeof marks?.underline === "string" ? marks.underline.trim() : "";
  if (phrase) next = paintPhrase(next, phrase, "underline");
  for (const bold of marks?.bold ?? []) {
    const word = bold.trim();
    if (word) next = paintPhrase(next, word, "bold");
  }
  return next;
}

function paintPhrase(runs: CopyRun[], phrase: string, kind: "bold" | "underline"): CopyRun[] {
  const next: CopyRun[] = [];
  for (const run of runs) {
    if (!run.text.includes(phrase)) {
      next.push(run);
      continue;
    }
    let cursor = 0;
    while (cursor < run.text.length) {
      const found = run.text.indexOf(phrase, cursor);
      if (found < 0) {
        next.push({ ...run, text: run.text.slice(cursor) });
        break;
      }
      if (found > cursor) next.push({ ...run, text: run.text.slice(cursor, found) });
      next.push({ ...run, text: phrase, [kind]: true });
      cursor = found + phrase.length;
    }
  }
  return next.filter((run) => run.text.length > 0);
}

export function sanitizeUnderline(text: string, value: unknown): true | string | false | undefined {
  if (value === false) return false;
  if (value === true) return true;
  if (typeof value !== "string") return undefined;
  const phrase = value.trim().slice(0, 120);
  if (!phrase || !text.includes(phrase)) return undefined;
  return phrase;
}

export function sanitizeBold(text: string, value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const phrase = item.trim().slice(0, 120);
    if (!phrase || phrase.length > 120 || !text.includes(phrase) || seen.has(phrase)) continue;
    seen.add(phrase);
    phrases.push(phrase);
    if (phrases.length >= 12) break;
  }
  return phrases;
}

export function toggleBoldPhrase(current: string[] | undefined, phrase: string): string[] {
  const clean = phrase.trim().slice(0, 120);
  const phrases = (current ?? []).map((item) => item.trim()).filter(Boolean);
  if (!clean) return phrases;
  if (phrases.includes(clean)) return phrases.filter((item) => item !== clean);
  return [...phrases, clean].slice(0, 12);
}

/** A selection underlines that phrase. An empty selection toggles the whole block. */
export function nextUnderline(current: true | string | false | undefined, selection: string): true | string | false {
  const phrase = selection.trim().slice(0, 120);
  if (phrase) return current === phrase ? false : phrase;
  return current ? false : true;
}

/** Wrap or unwrap the selection. An empty selection uses the whole value. */
export function toggleInlineMark(value: string, start: number, end: number, open: string, close: string): string {
  const rangeStart = start === end ? 0 : start;
  const rangeEnd = start === end ? value.length : end;
  const before = value.slice(0, rangeStart);
  const selected = value.slice(rangeStart, rangeEnd);
  const after = value.slice(rangeEnd);
  if (before.endsWith(open) && after.startsWith(close)) {
    return before.slice(0, -open.length) + selected + after.slice(close.length);
  }
  if (selected.startsWith(open) && selected.endsWith(close) && selected.length >= open.length + close.length) {
    return before + selected.slice(open.length, selected.length - close.length) + after;
  }
  return before + open + selected + close;
}

/**
 * "Participation design: Develop a …" becomes a point.
 * A long sentence with a colon stays one line.
 */
export function splitLead(text: string): PitchPoint | null {
  const idx = text.indexOf(":");
  if (idx < 2 || idx > 42) return null;
  const label = text.slice(0, idx).trim();
  const detail = text.slice(idx + 1).trim();
  if (!label || !detail) return null;
  if (/[.!?]/.test(label)) return null;
  if (label.split(/\s+/).length > 5) return null;
  return { label, detail };
}

/** Structured point, or a legacy "Label: detail" line. Null means render the item as one line. */
export function pitchPoint(item: string | PitchPoint): PitchPoint | null {
  if (typeof item === "string") return splitLead(item);
  const label = item.label.trim();
  const detail = item.detail.trim();
  if (!label) return null;
  return { label, detail };
}

export function isPitchPoint(value: unknown): value is PitchPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as PitchPoint;
  return typeof point.label === "string" && typeof point.detail === "string";
}

export function overlayListItem(base: string | PitchPoint, incoming: unknown, max: number): string | PitchPoint {
  if (typeof incoming === "string") {
    const text = incoming.slice(0, max);
    if (typeof base !== "string") return splitLead(text) ?? text;
    return text;
  }
  if (isPitchPoint(incoming)) {
    return {
      label: incoming.label.slice(0, 200),
      detail: incoming.detail.slice(0, max),
    };
  }
  return typeof base === "string" ? base : { label: base.label, detail: base.detail };
}

export function packTextBlock(
  type: TextStyle,
  text: string,
  source: object,
  inherited?: { underline?: true | string | false; bold?: string[] }
): CopyBlock {
  const hasUnderline = Object.prototype.hasOwnProperty.call(source, "underline");
  const hasBold = Object.prototype.hasOwnProperty.call(source, "bold");
  const underline = hasUnderline
    ? sanitizeUnderline(text, (source as { underline?: unknown }).underline)
    : inherited?.underline;
  const bold = hasBold ? sanitizeBold(text, (source as { bold?: unknown }).bold) : inherited?.bold ?? [];
  const block: Extract<CopyBlock, { text: string }> = { type, text };
  if (underline !== undefined) block.underline = underline;
  if (bold.length > 0) block.bold = bold;
  else if (hasBold) block.bold = [];
  return block;
}
