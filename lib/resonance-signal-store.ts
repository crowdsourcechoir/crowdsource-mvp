import {
  DEFAULT_RESONANCE_FIELD_ID,
  RESONANCE_FIELDS,
  RESONANCE_SESSION_SLUG,
  type ResonanceSignalState,
} from "@/data/resonanceSignal";
import type { ResonanceHoldSignal } from "@/data/octoSignalLayer";
import { supabaseAdmin } from "@/lib/supabase-server";

type MemoryResonanceStore = {
  holds: Array<Record<string, unknown>>;
  state: ResonanceSignalState;
};

type ResonancePayload = {
  fieldId: string;
  startedAt: string;
};

type HoldPayload = {
  durationMs: number;
  fieldId: string;
  kind: "resonance-hold";
  signalId: string;
};

const globalForResonance = globalThis as typeof globalThis & {
  __cscResonanceStore?: MemoryResonanceStore;
};

function nowIso() {
  return new Date().toISOString();
}

function memoryStore(): MemoryResonanceStore {
  if (!globalForResonance.__cscResonanceStore) {
    const now = nowIso();
    globalForResonance.__cscResonanceStore = {
      holds: [],
      state: {
        activeFieldId: DEFAULT_RESONANCE_FIELD_ID,
        fields: RESONANCE_FIELDS,
        signalId: `memory-${Date.now()}`,
        startedAt: now,
        updatedAt: now,
      },
    };
  }
  return globalForResonance.__cscResonanceStore;
}

function encodePrompt(payload: ResonancePayload) {
  return JSON.stringify({ kind: "resonance-signal", ...payload });
}

function decodePrompt(promptText: unknown): ResonancePayload | null {
  if (typeof promptText !== "string") return null;
  try {
    const parsed = JSON.parse(promptText) as Partial<ResonancePayload> & {
      kind?: string;
    };
    if (
      parsed.kind === "resonance-signal" &&
      typeof parsed.fieldId === "string" &&
      typeof parsed.startedAt === "string"
    ) {
      return { fieldId: parsed.fieldId, startedAt: parsed.startedAt };
    }
  } catch {
    return null;
  }
  return null;
}

function decodeHold(rawText: unknown): HoldPayload | null {
  if (typeof rawText !== "string") return null;
  try {
    const parsed = JSON.parse(rawText) as Partial<HoldPayload>;
    if (
      parsed.kind === "resonance-hold" &&
      typeof parsed.fieldId === "string" &&
      typeof parsed.signalId === "string" &&
      typeof parsed.durationMs === "number"
    ) {
      return {
        durationMs: Math.max(0, parsed.durationMs),
        fieldId: parsed.fieldId,
        kind: "resonance-hold",
        signalId: parsed.signalId,
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function getOrCreateSessionId(): Promise<string | null> {
  if (!supabaseAdmin) return null;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("prompt_game_sessions")
    .select("id")
    .eq("slug", RESONANCE_SESSION_SLUG)
    .maybeSingle();

  if (existing?.id) return existing.id as string;
  if (existingError && existingError.code !== "PGRST116") {
    throw new Error(existingError.message);
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from("prompt_game_sessions")
    .insert({
      slug: RESONANCE_SESSION_SLUG,
      name: "Resonance Signal",
      state: "WAITING",
      linked_event_id: null,
    })
    .select("id")
    .single();

  if (createError) throw new Error(createError.message);
  return created.id as string;
}

export async function getResonanceSignalState(): Promise<ResonanceSignalState> {
  const sessionId = await getOrCreateSessionId();
  if (!sessionId || !supabaseAdmin) return memoryStore().state;

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("prompt_game_sessions")
    .select("current_round_id, created_at")
    .eq("id", sessionId)
    .single();

  if (sessionError) throw new Error(sessionError.message);

  if (!session?.current_round_id) {
    return {
      activeFieldId: DEFAULT_RESONANCE_FIELD_ID,
      fields: RESONANCE_FIELDS,
      signalId: "idle",
      startedAt: (session?.created_at as string | null) ?? nowIso(),
      updatedAt: nowIso(),
    };
  }

  const { data: round, error: roundError } = await supabaseAdmin
    .from("prompt_game_rounds")
    .select("id, prompt_text, created_at")
    .eq("id", session.current_round_id)
    .single();

  if (roundError) throw new Error(roundError.message);
  const payload = decodePrompt(round.prompt_text);
  const startedAt = payload?.startedAt ?? (round.created_at as string) ?? nowIso();

  return {
    activeFieldId: payload?.fieldId ?? DEFAULT_RESONANCE_FIELD_ID,
    fields: RESONANCE_FIELDS,
    signalId: round.id as string,
    startedAt,
    updatedAt: startedAt,
  };
}

export async function setResonanceSignalField(fieldId: string): Promise<ResonanceSignalState> {
  if (!RESONANCE_FIELDS.some((field) => field.id === fieldId)) {
    throw new Error("Unknown resonance field.");
  }

  const startedAt = nowIso();
  const sessionId = await getOrCreateSessionId();
  if (!sessionId || !supabaseAdmin) {
    const state: ResonanceSignalState = {
      activeFieldId: fieldId,
      fields: RESONANCE_FIELDS,
      signalId: `memory-${Date.now()}`,
      startedAt,
      updatedAt: startedAt,
    };
    memoryStore().state = state;
    return state;
  }

  const { data: round, error: roundError } = await supabaseAdmin
    .from("prompt_game_rounds")
    .insert({
      session_id: sessionId,
      prompt_text: encodePrompt({ fieldId, startedAt }),
      response_type: "short_phrase",
      character_limit: 80,
      timer_seconds: null,
    })
    .select("id")
    .single();

  if (roundError) throw new Error(roundError.message);

  const { error: sessionError } = await supabaseAdmin
    .from("prompt_game_sessions")
    .update({ state: "RESPONDING", current_round_id: round.id })
    .eq("id", sessionId);

  if (sessionError) throw new Error(sessionError.message);

  return {
    activeFieldId: fieldId,
    fields: RESONANCE_FIELDS,
    signalId: round.id as string,
    startedAt,
    updatedAt: startedAt,
  };
}

export async function recordResonanceHoldSignal(data: {
  deviceId: string;
  durationMs: number;
  fieldId: string;
  signalId: string;
}) {
  const payload = {
    kind: "resonance-hold",
    durationMs: Math.max(0, Math.round(data.durationMs)),
    fieldId: data.fieldId,
    signalId: data.signalId,
  };

  if (!supabaseAdmin || data.signalId.startsWith("memory-")) {
    memoryStore().holds.push({ ...payload, deviceId: data.deviceId, createdAt: nowIso() });
    return;
  }

  const sessionId = await getOrCreateSessionId();
  if (!sessionId) return;

  const { error } = await supabaseAdmin
    .from("prompt_game_submissions")
    .insert({
      session_id: sessionId,
      round_id: data.signalId,
      device_id: data.deviceId,
      raw_text: JSON.stringify(payload),
    });

  if (error) throw new Error(error.message);
}

export async function listRecentResonanceHolds(signalId: string): Promise<ResonanceHoldSignal[]> {
  if (!supabaseAdmin || signalId.startsWith("memory-")) {
    return memoryStore().holds
      .map((hold) => {
        const payload = decodeHold(JSON.stringify(hold));
        if (!payload) return null;
        return {
          createdAt: String(hold.createdAt ?? nowIso()),
          deviceId: String(hold.deviceId ?? ""),
          durationMs: payload.durationMs,
          fieldId: payload.fieldId,
          signalId: payload.signalId,
        };
      })
      .filter((hold): hold is ResonanceHoldSignal => Boolean(hold));
  }

  const { data, error } = await supabaseAdmin
    .from("prompt_game_submissions")
    .select("device_id, raw_text, created_at")
    .eq("round_id", signalId)
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const payload = decodeHold(row.raw_text);
      if (!payload) return null;
      return {
        createdAt: row.created_at as string,
        deviceId: row.device_id as string,
        durationMs: payload.durationMs,
        fieldId: payload.fieldId,
        signalId: payload.signalId,
      };
    })
    .filter((hold): hold is ResonanceHoldSignal => Boolean(hold));
}
