import { getResonanceField, type ResonanceSignalState } from "@/data/resonanceSignal";

export type OctoSignalDimension =
  | "resonance"
  | "coherence"
  | "density"
  | "momentum"
  | "tensionRelease"
  | "attention";

export type OctoSignalSource = "resonance";

export type OctoSignalValue = {
  confidence: number;
  value: number;
};

export type OctoFieldSignal = {
  color: string;
  fieldId: string;
  holdMs: number;
  label: string;
  resonance: number;
  uniqueDevices: number;
};

export type OctoSignalFrame = {
  activeField: {
    color: string;
    fieldId: string;
    label: string;
  };
  dimensions: Record<OctoSignalDimension, OctoSignalValue>;
  fields: OctoFieldSignal[];
  generatedAt: string;
  interpretation: {
    atmosphere: string;
    movement: "arriving" | "gathering" | "cresting" | "settling";
    summary: string;
  };
  source: OctoSignalSource;
  sourceSignalId: string;
  version: "octo.signal.v0";
  windowMs: number;
};

export type ResonanceHoldSignal = {
  createdAt: string;
  deviceId: string;
  durationMs: number;
  fieldId: string;
  signalId: string;
};

const DEFAULT_SIGNAL_WINDOW_MS = 30_000;

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(value, 1));
}

function roundSignal(value: number) {
  return Math.round(clamp01(value) * 1000) / 1000;
}

function signal(value: number, confidence: number): OctoSignalValue {
  return {
    confidence: roundSignal(confidence),
    value: roundSignal(value),
  };
}

function saturate(value: number, scale: number) {
  if (value <= 0) return 0;
  return 1 - Math.exp(-value / scale);
}

function parseTime(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function fieldAtmosphere(fieldId: string) {
  switch (fieldId) {
    case "yellow":
      return "brightening";
    case "teal":
      return "flowing";
    case "blue":
      return "deepening";
    case "violet":
    default:
      return "opening";
  }
}

export function interpretResonanceAsOctoSignal(
  state: ResonanceSignalState,
  holds: ResonanceHoldSignal[],
  options?: {
    now?: Date;
    windowMs?: number;
  }
): OctoSignalFrame {
  const now = options?.now ?? new Date();
  const windowMs = options?.windowMs ?? DEFAULT_SIGNAL_WINDOW_MS;
  const cutoff = now.getTime() - windowMs;
  const activeField = getResonanceField(state.activeFieldId);
  const relevantHolds = holds.filter((hold) => {
    const createdAt = parseTime(hold.createdAt);
    return hold.signalId === state.signalId && createdAt >= cutoff;
  });

  const fields = state.fields.map((field) => {
    const fieldHolds = relevantHolds.filter((hold) => hold.fieldId === field.id);
    const holdMs = fieldHolds.reduce((sum, hold) => sum + hold.durationMs, 0);
    const uniqueDevices = new Set(fieldHolds.map((hold) => hold.deviceId)).size;
    return {
      color: field.color,
      fieldId: field.id,
      holdMs,
      label: field.label,
      resonance: roundSignal(saturate(holdMs, windowMs * 0.32)),
      uniqueDevices,
    };
  });

  const totalHoldMs = fields.reduce((sum, field) => sum + field.holdMs, 0);
  const totalDevices = new Set(relevantHolds.map((hold) => hold.deviceId)).size;
  const activeFieldSignal =
    fields.find((field) => field.fieldId === state.activeFieldId) ?? fields[0];
  const activeShare = totalHoldMs > 0 ? activeFieldSignal.holdMs / totalHoldMs : 0;
  const recentHoldCount = relevantHolds.length;
  const recentStartedAt =
    relevantHolds.length > 0
      ? Math.min(...relevantHolds.map((hold) => parseTime(hold.createdAt)))
      : now.getTime();
  const recentSpanMs = Math.max(1, now.getTime() - recentStartedAt);
  const holdRatePerSecond = recentHoldCount / (recentSpanMs / 1000);

  const resonance = saturate(activeFieldSignal.holdMs, windowMs * 0.28);
  const density = saturate(totalDevices, 18);
  const coherence = totalHoldMs > 0 ? activeShare : 0;
  const momentum = saturate(holdRatePerSecond, 0.9);
  const tensionRelease =
    activeField.id === "yellow" || activeField.id === "teal"
      ? resonance * 0.62 + momentum * 0.28
      : resonance * 0.34 + (1 - momentum) * 0.22;
  const attention =
    recentHoldCount === 0 ? 0.22 : clamp01(coherence * 0.52 + resonance * 0.36);
  const confidence = clamp01(0.24 + saturate(recentHoldCount, 10) * 0.48 + density * 0.28);
  const movement: OctoSignalFrame["interpretation"]["movement"] =
    resonance > 0.78
      ? "cresting"
      : momentum > 0.5
        ? "gathering"
        : recentHoldCount > 0
          ? "arriving"
          : "settling";

  return {
    activeField: {
      color: activeField.color,
      fieldId: activeField.id,
      label: activeField.label,
    },
    dimensions: {
      attention: signal(attention, confidence),
      coherence: signal(coherence, confidence),
      density: signal(density, confidence),
      momentum: signal(momentum, confidence),
      resonance: signal(resonance, confidence),
      tensionRelease: signal(tensionRelease, confidence),
    },
    fields,
    generatedAt: now.toISOString(),
    interpretation: {
      atmosphere: fieldAtmosphere(activeField.id),
      movement,
      summary:
        recentHoldCount > 0
          ? `${activeField.label} field is ${movement}`
          : `${activeField.label} field is open`,
    },
    source: "resonance",
    sourceSignalId: state.signalId,
    version: "octo.signal.v0",
    windowMs,
  };
}
