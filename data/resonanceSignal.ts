export type ResonanceField = {
  id: string;
  label: string;
  color: string;
  core: string;
  shadow: string;
};

export type ResonanceSignalState = {
  activeFieldId: string;
  fields: ResonanceField[];
  signalId: string;
  startedAt: string;
  updatedAt: string;
};

export const RESONANCE_FIELDS: ResonanceField[] = [
  {
    id: "violet",
    label: "Violet",
    color: "#9b5cff",
    core: "#ead8ff",
    shadow: "rgba(155, 92, 255, 0.38)",
  },
  {
    id: "teal",
    label: "Teal",
    color: "#15d1b3",
    core: "#cbfff6",
    shadow: "rgba(21, 209, 179, 0.36)",
  },
  {
    id: "yellow",
    label: "Yellow",
    color: "#ffd84d",
    core: "#fff5bd",
    shadow: "rgba(255, 216, 77, 0.38)",
  },
  {
    id: "blue",
    label: "Blue",
    color: "#55a7ff",
    core: "#d8ecff",
    shadow: "rgba(85, 167, 255, 0.38)",
  },
];

export const DEFAULT_RESONANCE_FIELD_ID = RESONANCE_FIELDS[0].id;
export const RESONANCE_SESSION_SLUG = "resonance-live";

export function getResonanceField(fieldId: string | null | undefined): ResonanceField {
  return (
    RESONANCE_FIELDS.find((field) => field.id === fieldId) ??
    RESONANCE_FIELDS[0]
  );
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Request failed");
  }
  return res.json();
}

export async function getResonanceState(): Promise<ResonanceSignalState> {
  return api<ResonanceSignalState>("/api/resonance/state");
}

export async function setResonanceField(fieldId: string): Promise<ResonanceSignalState> {
  return api<ResonanceSignalState>("/api/resonance/state", {
    method: "POST",
    body: JSON.stringify({ fieldId }),
  });
}

export async function recordResonanceHold(data: {
  deviceId: string;
  durationMs: number;
  fieldId: string;
  signalId: string;
}): Promise<void> {
  await api("/api/resonance/hold", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
