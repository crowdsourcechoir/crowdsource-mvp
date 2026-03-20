import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase-server";

export const maxDuration = 60;

type SongPack = {
  topRawLines: string[];
  themes: string[];
  hookCandidates: string[];
  chorusConcepts: string[];
  emotionalContrasts: string[];
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not set." },
      { status: 503 }
    );
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { id: sessionId } = await context.params;

  try {
    const { data: submissions, error: subErr } = await supabaseAdmin
      .from("prompt_game_submissions")
      .select("raw_text, round_id")
      .eq("session_id", sessionId)
      .eq("hidden", false)
      .order("created_at", { ascending: true });
    if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
    const lines = (submissions ?? []).map((s) => (s.raw_text ?? "").trim()).filter(Boolean);
    if (lines.length === 0) {
      return NextResponse.json({ error: "No submissions to process." }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });
    const prompt = `You are a songwriter and lyricist. Below are raw audience submissions from a live prompt game. Do NOT rewrite or replace them. Analyze and extract:

1. topRawLines: 8–15 of the strongest exact phrases (verbatim), suitable as song lines.
2. themes: 4–8 short theme labels (e.g. "hope", "missing home", "celebration").
3. hookCandidates: 4–6 phrases that could work as a chorus hook (exact or very close to original).
4. chorusConcepts: 2–4 one-sentence ideas for a chorus.
5. emotionalContrasts: 2–4 pairs or contrasts (e.g. "lonely vs together").

Return ONLY valid JSON in this shape (no markdown):
{
  "topRawLines": ["...", "..."],
  "themes": ["...", "..."],
  "hookCandidates": ["...", "..."],
  "chorusConcepts": ["...", "..."],
  "emotionalContrasts": ["...", "..."]
}

Raw submissions (one per line):
${lines.join("\n")}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    let payload: SongPack;
    try {
      payload = JSON.parse(cleaned) as SongPack;
    } catch {
      return NextResponse.json({ error: "AI returned invalid format." }, { status: 500 });
    }

    const { error: insertErr } = await supabaseAdmin.from("prompt_game_ai_outputs").insert({
      session_id: sessionId,
      round_id: null,
      kind: "song_pack",
      payload,
    });
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("AI process error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
