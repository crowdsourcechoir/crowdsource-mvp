import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import OpenAI from "openai";
import { localGetEventTranscripts } from "@/lib/local-agent-interview-store";
import { localUpsertSongSeedForEvent } from "@/lib/local-song-seeds-store";

export const maxDuration = 60;

const SONG_SEED_SYSTEM = `You are analyzing agent interview transcripts from an event to produce a "Song Seed" for songwriting.

Given the full transcript (multiple participants, each with agent questions and user answers), produce a JSON object with:

1. "topThemes": array of 3–8 short theme labels (e.g. "gratitude", "memories with Sarah", "hopes for the future").
2. "notableLines": array of 10–30 exact or near-exact striking lines from the transcripts that could inspire lyrics. Keep them short and vivid.
3. "singableHooks": array of 3–10 short, catchy phrases that could work as chorus or hook lines.
4. "shoutouts": array of first names or safe shoutouts mentioned (first names only, no full names or private info).
5. "emotionalToneSummary": 1–3 sentences describing the overall emotional tone of the responses.
6. "sourceMapping": array of objects for key items, each with "field" (one of: topThemes, notableLines, singableHooks, shoutouts), "participantId" or "turnId" or "lineIndex" if you can infer from context, and optional "text" snippet. Keep it minimal if you don't have turn IDs.
7. "sunoPrompts": array of exactly 3 ready-to-paste song prompts for the Suno AI song engine. Each prompt should be a single paragraph (2–4 sentences) that a user can copy and drop into Suno. Include: genre/mood, instrumentation feel, vocal style, and key themes or hooks from the interviews. Make each of the 3 prompts distinct (e.g. different genre or angle) so the event host can choose. No markdown, no labels—just the raw prompt text.

Respond with ONLY valid JSON in this shape (no markdown):
{
  "topThemes": ["theme1", "theme2", ...],
  "notableLines": ["line1", "line2", ...],
  "singableHooks": ["hook1", "hook2", ...],
  "shoutouts": ["Name1", "Name2", ...],
  "emotionalToneSummary": "...",
  "sourceMapping": [{"field": "notableLines", "text": "..."}, ...],
  "sunoPrompts": ["First full Suno prompt paragraph.", "Second full Suno prompt paragraph.", "Third full Suno prompt paragraph."]
}`;

function rowToSongSeed(row: Record<string, unknown>) {
  return {
    id: row.id,
    eventId: row.event_id,
    topThemes: Array.isArray(row.top_themes) ? row.top_themes : [],
    notableLines: Array.isArray(row.notable_lines) ? row.notable_lines : [],
    singableHooks: Array.isArray(row.singable_hooks) ? row.singable_hooks : [],
    shoutouts: Array.isArray(row.shoutouts) ? row.shoutouts : [],
    emotionalToneSummary: (row.emotional_tone_summary as string) ?? "",
    sourceMapping: Array.isArray(row.source_mapping) ? row.source_mapping : [],
    sunoPrompts: Array.isArray(row.suno_prompts) ? row.suno_prompts : [],
    createdAt: row.created_at,
  };
}

export async function POST(request: Request) {
  const useLocal = process.env.USE_LOCAL_EVENTS === "true";

  // Local-only fallback so you can generate seeds from locally stored answers.
  if (useLocal) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set." }, { status: 503 });
    }

    try {
      const body = await request.json();
      const { eventId } = body as { eventId?: string };
      if (!eventId) {
        return NextResponse.json({ error: "eventId is required." }, { status: 400 });
      }

      const transcripts = await localGetEventTranscripts(eventId);
      if (!transcripts.length) {
        return NextResponse.json({ error: "No agent conversations found for this event." }, { status: 400 });
      }

      let transcriptText = "";
      for (const t of transcripts) {
        transcriptText += `\n--- Participant: ${t.participantName} (conversation ${t.conversationId}) ---\n`;
        for (const turn of t.turns) {
          const role = turn.role === "agent" ? "Agent" : "Participant";
          transcriptText += `${role}: ${turn.content}\n`;
        }
      }

      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SONG_SEED_SYSTEM },
          { role: "user", content: `Transcripts:\n${transcriptText.trim()}` },
        ],
        max_tokens: 2048,
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? "";
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

      let parsed: {
        topThemes?: string[];
        notableLines?: string[];
        singableHooks?: string[];
        shoutouts?: string[];
        emotionalToneSummary?: string;
        sourceMapping?: unknown[];
        sunoPrompts?: string[];
      };
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return NextResponse.json({ error: "AI returned invalid JSON for Song Seed." }, { status: 500 });
      }

      const payload = {
        id: "local",
        eventId,
        topThemes: parsed.topThemes ?? [],
        notableLines: parsed.notableLines ?? [],
        singableHooks: parsed.singableHooks ?? [],
        shoutouts: parsed.shoutouts ?? [],
        emotionalToneSummary: parsed.emotionalToneSummary ?? "",
        sourceMapping: Array.isArray(parsed.sourceMapping) ? parsed.sourceMapping : [],
        sunoPrompts: Array.isArray(parsed.sunoPrompts) ? parsed.sunoPrompts.slice(0, 3) : [],
        createdAt: new Date().toISOString(),
      };

      await localUpsertSongSeedForEvent(eventId, payload);
      return NextResponse.json(payload);
    } catch (err) {
      console.error("Local song seed generate error:", err);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set." },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const { eventId } = body as { eventId?: string };
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required." }, { status: 400 });
    }

    const isLocalEvent = process.env.USE_LOCAL_EVENTS === "true" && eventId.startsWith("local-");
    const { data: convs, error: eConvs } = isLocalEvent
      ? await supabaseAdmin
          .from("agent_conversations")
          .select("id, participant_id")
          .eq("local_event_id", eventId)
      : await supabaseAdmin
          .from("agent_conversations")
          .select("id, participant_id")
          .eq("event_id", eventId);
    if (eConvs || !convs?.length) {
      return NextResponse.json(
        { error: "No agent conversations found for this event." },
        { status: 400 }
      );
    }

    const participantIds = convs.map((c) => c.participant_id);
    const { data: participants } = await supabaseAdmin
      .from("agent_participants")
      .select("id, name")
      .in("id", participantIds);
    const nameById = new Map((participants ?? []).map((p: { id: string; name: string | null }) => [p.id, p.name ?? "Anonymous"]));

    let transcriptText = "";
    const turnRefs: { conversationId: string; participantId: string; turnId: string; role: string; content: string }[] = [];

    for (const conv of convs) {
      const { data: turns } = await supabaseAdmin
        .from("agent_conversation_turns")
        .select("id, turn_index, role, content")
        .eq("conversation_id", conv.id)
        .order("turn_index", { ascending: true });
      const name = nameById.get(conv.participant_id) ?? "Anonymous";
      transcriptText += `\n--- Participant: ${name} (conversation ${conv.id}) ---\n`;
      for (const t of turns ?? []) {
        const role = t.role === "agent" ? "Agent" : "Participant";
        transcriptText += `${role}: ${t.content}\n`;
        turnRefs.push({
          conversationId: conv.id,
          participantId: conv.participant_id,
          turnId: t.id,
          role: t.role,
          content: t.content,
        });
      }
    }

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SONG_SEED_SYSTEM },
        { role: "user", content: `Transcripts:\n${transcriptText.trim()}` },
      ],
      max_tokens: 2048,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    let parsed: {
      topThemes?: string[];
      notableLines?: string[];
      singableHooks?: string[];
      shoutouts?: string[];
      emotionalToneSummary?: string;
      sourceMapping?: Array<{ field: string; participantId?: string; turnId?: string; lineIndex?: number; text?: string }>;
      sunoPrompts?: string[];
    };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid JSON for Song Seed." },
        { status: 500 }
      );
    }

    if (isLocalEvent) {
      return NextResponse.json({
        id: "local",
        eventId,
        topThemes: parsed.topThemes ?? [],
        notableLines: parsed.notableLines ?? [],
        singableHooks: parsed.singableHooks ?? [],
        shoutouts: parsed.shoutouts ?? [],
        emotionalToneSummary: parsed.emotionalToneSummary ?? "",
        sourceMapping: parsed.sourceMapping ?? [],
        sunoPrompts: Array.isArray(parsed.sunoPrompts) ? parsed.sunoPrompts.slice(0, 3) : [],
        createdAt: new Date().toISOString(),
      });
    }

    const { data: inserted, error: eInsert } = await supabaseAdmin
      .from("song_seeds")
      .insert({
        event_id: eventId,
        top_themes: parsed.topThemes ?? [],
        notable_lines: parsed.notableLines ?? [],
        singable_hooks: parsed.singableHooks ?? [],
        shoutouts: parsed.shoutouts ?? [],
        emotional_tone_summary: parsed.emotionalToneSummary ?? "",
        source_mapping: parsed.sourceMapping ?? [],
        suno_prompts: Array.isArray(parsed.sunoPrompts) ? parsed.sunoPrompts.slice(0, 3) : [],
      })
      .select()
      .single();
    if (eInsert || !inserted) {
      return NextResponse.json({ error: eInsert?.message ?? "Failed to save Song Seed." }, { status: 400 });
    }
    return NextResponse.json(rowToSongSeed(inserted));
  } catch (err) {
    console.error("Song seed generate error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
