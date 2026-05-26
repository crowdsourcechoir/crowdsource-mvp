import { NextResponse } from "next/server";
import OpenAI from "openai";
import { generateCompositionBrief } from "@/lib/composition/build-brief";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { CompositionBrief } from "@/lib/composition/types";

export const maxDuration = 60;

const BRIEF_KIND = "composition_brief";

function parseScope(searchParams: URLSearchParams): { eventId: string | null; sessionId: string | null } {
  const eventId = searchParams.get("eventId")?.trim() || null;
  const sessionId = searchParams.get("sessionId")?.trim() || null;
  return { eventId, sessionId };
}

async function resolveSessionIdsForLookup(eventId: string | null, sessionId: string | null): Promise<string[]> {
  if (!supabaseAdmin) return sessionId ? [sessionId] : [];

  const ids = new Set<string>();
  if (sessionId) ids.add(sessionId);

  if (eventId) {
    const { data, error } = await supabaseAdmin
      .from("prompt_game_sessions")
      .select("id")
      .eq("linked_event_id", eventId);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) ids.add(row.id);
  }

  return Array.from(ids);
}

async function fetchLatestBrief(sessionIds: string[]): Promise<CompositionBrief | null> {
  if (!supabaseAdmin || sessionIds.length === 0) return null;

  const { data, error } = await supabaseAdmin
    .from("prompt_game_ai_outputs")
    .select("payload, created_at")
    .in("session_id", sessionIds)
    .eq("kind", BRIEF_KIND)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.payload) return null;
  return data.payload as CompositionBrief;
}

async function persistBrief(sessionId: string, brief: CompositionBrief): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from("prompt_game_ai_outputs").insert({
    session_id: sessionId,
    round_id: null,
    kind: BRIEF_KIND,
    payload: brief,
  });
  if (error) throw new Error(error.message);
}

/** Return the latest cached Composition Brief for an event or session. */
export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const { eventId, sessionId } = parseScope(new URL(request.url).searchParams);
  if (!eventId && !sessionId) {
    return NextResponse.json({ error: "eventId or sessionId is required." }, { status: 400 });
  }

  try {
    const sessionIds = await resolveSessionIdsForLookup(eventId, sessionId);
    const brief = await fetchLatestBrief(sessionIds);
    if (!brief) {
      return NextResponse.json({ error: "No Composition Brief generated yet." }, { status: 404 });
    }
    return NextResponse.json(brief);
  } catch (err) {
    console.error("Composition brief GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

/** Gather material and generate a new Composition Brief. */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set." }, { status: 503 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      eventId?: string | null;
      sessionId?: string | null;
    };
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() || null : null;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() || null : null;

    if (!eventId && !sessionId) {
      return NextResponse.json({ error: "eventId or sessionId is required." }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });
    const brief = await generateCompositionBrief(openai, { eventId, sessionId });

    const persistSessionId = sessionId ?? brief.sessionIds[0] ?? null;
    if (persistSessionId) {
      await persistBrief(persistSessionId, brief);
    }

    return NextResponse.json(brief);
  } catch (err) {
    console.error("Composition brief POST error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    const status = message.includes("No composition material") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
