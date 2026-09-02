export type ActivitySummary = {
  participantsTotal: number;
  participantsRecent: number;
  clipsTotal: number;
  clipsRecent: number;
  windowMinutes: number;
};

export const PARTICIPANT_COUNT_THRESHOLD = 20;

export type AmbientLineKind = "count" | "recent" | "ambient";

export type AmbientLine = {
  text: string;
  kind: AmbientLineKind;
};

/** Deliberately vague — never fabricates specific names, places, or counts. */
const SIMULATED_AMBIENT_LINES = [
  "Another voice is warming up nearby",
  "The garden is stirring…",
  "Someone else is about to add a sound",
  "More of the crowd is joining in",
  "A quiet hum of activity nearby",
  "The crowd is gathering",
  "Someone just stepped into the journey",
];

const COUNT_LINE_TEMPLATES = [
  (n: number) => `${n} people have shaped this world so far`,
  (n: number) => `${n} voices in the garden`,
  (n: number) => `${n} participants and counting`,
];

function pickCountLine(total: number): AmbientLine {
  const template = COUNT_LINE_TEMPLATES[Math.floor(Math.random() * COUNT_LINE_TEMPLATES.length)];
  return { text: template(total), kind: "count" };
}

/**
 * Builds the ambient line pool for one moment. Participant totals appear only once
 * the crowd crosses PARTICIPANT_COUNT_THRESHOLD; below that, generic signs of life
 * carry the atmosphere. After the threshold, count lines mix with recent activity
 * and ambient filler.
 */
export function buildAmbientLinePool(
  summary: ActivitySummary | null,
  simulationEnabled: boolean
): AmbientLine[] {
  const lines: AmbientLine[] = [];
  const total = summary?.participantsTotal ?? 0;
  const showCounts = total >= PARTICIPANT_COUNT_THRESHOLD;

  if (summary) {
    if (showCounts) {
      lines.push(pickCountLine(total));
    }
    if (summary.clipsRecent > 0) {
      lines.push({
        text:
          summary.clipsRecent === 1
            ? "Someone just added a sound to the garden"
            : `${summary.clipsRecent} sounds just landed in the garden`,
        kind: "recent",
      });
    }
    if (summary.participantsRecent > 0) {
      lines.push({
        text:
          summary.participantsRecent === 1
            ? "A new voice just joined"
            : `${summary.participantsRecent} new voices just joined`,
        kind: "recent",
      });
    }
  }

  const belowThreshold = total < PARTICIPANT_COUNT_THRESHOLD;
  if (simulationEnabled && (belowThreshold || lines.length === 0)) {
    for (const text of SIMULATED_AMBIENT_LINES) {
      lines.push({ text, kind: "ambient" });
    }
  } else if (simulationEnabled && showCounts) {
    // After 20+, sprinkle generic signs of life so the ticker isn't all counts.
    const shuffled = [...SIMULATED_AMBIENT_LINES].sort(() => Math.random() - 0.5);
    for (const text of shuffled.slice(0, 3)) {
      lines.push({ text, kind: "ambient" });
    }
  }

  return lines;
}

/** @deprecated Prefer buildAmbientLinePool — kept for simple consumers. */
export function buildAmbientLines(
  summary: ActivitySummary | null,
  simulationEnabled: boolean
): string[] {
  return buildAmbientLinePool(summary, simulationEnabled).map((line) => line.text);
}

/** Weighted pick — count lines are rarer so the bubble feels organic, not a counter. */
export function pickNextAmbientLine(
  pool: AmbientLine[],
  lastText: string | null
): AmbientLine | null {
  if (!pool.length) return null;

  let candidates = pool.filter((line) => line.text !== lastText);
  if (!candidates.length) candidates = pool;

  const weights = candidates.map((line) => {
    if (line.kind === "count") return 0.22;
    if (line.kind === "recent") return 0.38;
    return 0.4;
  });
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
