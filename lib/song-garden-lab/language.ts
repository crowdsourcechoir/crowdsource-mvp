/**
 * Words → three latent numbers. They are not a genome and not a picture.
 * A confidence under the gate is ignored. The ribbon does not read this.
 */
export const LANGUAGE_VERSION = "lab-e-1";
export const LANGUAGE_GATE = 0.5;

export const LANGUAGE_AXES = ["hold", "outward", "weight"] as const;
export type LanguageAxis = (typeof LANGUAGE_AXES)[number];

export type LanguageScore = {
  value: number;
  confidence: number;
};

export type LanguageReading = {
  version: string;
  text: string;
  /** False when no model answered. The phrase is still the phrase. */
  available: boolean;
  hold: LanguageScore;
  outward: LanguageScore;
  weight: LanguageScore;
};

const EMPTY: LanguageScore = { value: 0, confidence: 0 };

export function ignoredLanguage(text: string, available = false): LanguageReading {
  return {
    version: LANGUAGE_VERSION,
    text,
    available,
    hold: { ...EMPTY },
    outward: { ...EMPTY },
    weight: { ...EMPTY },
  };
}

export function languageFromModel(text: string, raw: unknown, available = true): LanguageReading {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const confidence = record.confidence && typeof record.confidence === "object" ? (record.confidence as Record<string, unknown>) : {};
  const reading = ignoredLanguage(text, available);
  for (const axis of LANGUAGE_AXES) {
    reading[axis] = {
      value: unit(record[axis]),
      confidence: unit(confidence[axis]),
    };
  }
  return reading;
}

export function axisUsed(score: LanguageScore): boolean {
  return score.confidence >= LANGUAGE_GATE;
}

export function usedAxes(reading: LanguageReading): LanguageAxis[] {
  return LANGUAGE_AXES.filter((axis) => axisUsed(reading[axis]));
}

function unit(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}
