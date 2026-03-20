import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

function isSpam(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 2) return true;
  if (/^(.)\1{20,}$/.test(t)) return true;
  if (/^[^a-z0-9]+$/i.test(t)) return true;
  return false;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { id: sessionId } = await context.params;
  const { searchParams } = new URL(request.url);
  const roundId = searchParams.get("round_id");
  if (!roundId) {
    return NextResponse.json({ error: "round_id required." }, { status: 400 });
  }
  try {
    const { data: submissions, error: subErr } = await supabaseAdmin
      .from("prompt_game_submissions")
      .select("id, raw_text, hidden, locked")
      .eq("session_id", sessionId)
      .eq("round_id", roundId);
    if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

    const normalized = new Map<string, { id: string; raw_text: string; hidden: boolean; locked: boolean }>();
    for (const s of submissions ?? []) {
      const text = (s.raw_text ?? "").trim();
      if (isSpam(text)) continue;
      const key = text.toLowerCase().slice(0, 200);
      if (!normalized.has(key)) {
        normalized.set(key, {
          id: s.id,
          raw_text: text,
          hidden: s.hidden === true,
          locked: s.locked === true,
        });
      }
    }

    const { data: votes, error: votesErr } = await supabaseAdmin
      .from("prompt_game_votes")
      .select("submission_id")
      .eq("round_id", roundId);
    if (votesErr) return NextResponse.json({ error: votesErr.message }, { status: 500 });
    const countBySub: Record<string, number> = {};
    for (const v of votes ?? []) {
      countBySub[v.submission_id] = (countBySub[v.submission_id] ?? 0) + 1;
    }

    const cards = Array.from(normalized.values())
      .map((s) => ({
        id: s.id,
        raw_text: s.raw_text,
        vote_count: countBySub[s.id] ?? 0,
        hidden: s.hidden,
        locked: s.locked,
      }))
      .filter((c) => !c.hidden)
      .sort((a, b) => b.vote_count - a.vote_count)
      .slice(0, 12);

    return NextResponse.json(cards);
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
