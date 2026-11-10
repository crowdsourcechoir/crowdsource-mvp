export type PitchTextPart = { bold: boolean; text: string };

/** Split **marked** words out of a pitch line. Markers stay in the stored text. */
export function pitchTextParts(text: string): PitchTextPart[] {
  const parts: PitchTextPart[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const index = match.index;
    if (index > last) parts.push({ bold: false, text: text.slice(last, index) });
    parts.push({ bold: true, text: match[1] ?? "" });
    last = index + match[0].length;
  }
  if (last < text.length || parts.length === 0) parts.push({ bold: false, text: text.slice(last) });
  return parts;
}

export function plainPitchText(text: string): string {
  return pitchTextParts(text)
    .map((part) => part.text)
    .join("");
}

/** Bold or unbold the selected slice. An empty selection is left unchanged. */
export function toggleBoldMarkup(
  value: string,
  start: number,
  end: number
): { value: string; start: number; end: number } {
  if (start < 0 || end > value.length || start >= end) return { value, start, end };
  const selected = value.slice(start, end);
  if (selected.startsWith("**") && selected.endsWith("**") && selected.length >= 4) {
    const inner = selected.slice(2, -2);
    return { value: value.slice(0, start) + inner + value.slice(end), start, end: start + inner.length };
  }
  if (value.slice(start - 2, start) === "**" && value.slice(end, end + 2) === "**") {
    return {
      value: value.slice(0, start - 2) + selected + value.slice(end + 2),
      start: start - 2,
      end: end - 2,
    };
  }
  const wrapped = `**${selected}**`;
  return { value: value.slice(0, start) + wrapped + value.slice(end), start, end: start + wrapped.length };
}
