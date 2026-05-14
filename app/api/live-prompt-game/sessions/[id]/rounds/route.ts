import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { parsePromptBlock, signalChoiceDeviceId } from "@/data/signalPromptBlock";

function rowToRound(row: Record<string, unknown>) {
  return {
    id: row.id,
    session_id: row.session_id,
    prompt_text: row.prompt_text,
    response_type: row.response_type ?? "short_phrase",
    character_limit: row.character_limit ?? 140,
    timer_seconds: row.timer_seconds ?? null,
    created_at: row.created_at,
    closed_at: row.closed_at ?? null,
    prompt_block: parsePromptBlock(row.prompt_block) ?? null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { id: sessionId } = await params;
  try {
    const { data, error } = await supabaseAdmin
      .from("prompt_game_rounds")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data ?? []).map(rowToRound));
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { id: sessionId } = await params;
  try {
    const body = await request.json();
    const prompt_text = typeof body.prompt_text === "string" ? body.prompt_text.trim() : "";
    if (!prompt_text) {
      return NextResponse.json({ error: "prompt_text is required." }, { status: 400 });
    }
    const response_type = ["one_word", "short_phrase", "sentence"].includes(body.response_type)
      ? body.response_type
      : "short_phrase";
    const character_limit = typeof body.character_limit === "number" ? body.character_limit : 140;
    const timer_seconds = body.timer_seconds != null ? Number(body.timer_seconds) : null;

    const prompt_block_parsed =
      body.prompt_block !== undefined && body.prompt_block !== null
        ? parsePromptBlock(body.prompt_block)
        : null;
    if (body.prompt_block !== undefined && body.prompt_block !== null && !prompt_block_parsed) {
      return NextResponse.json({ error: "Invalid prompt_block payload." }, { status: 400 });
    }

    const insertRow: Record<string, unknown> = {
      session_id: sessionId,
      prompt_text,
      response_type,
      character_limit,
      timer_seconds,
    };
    if (prompt_block_parsed) {
      insertRow.prompt_block = prompt_block_parsed;
    }

    const { data: round, error: insertError } = await supabaseAdmin
      .from("prompt_game_rounds")
      .insert(insertRow)
      .select()
      .single();
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

    if (prompt_block_parsed && prompt_block_parsed.kind === "signal") {
      const submissionIds: string[] = [];
      for (const ch of prompt_block_parsed.choices) {
        const { data: sub, error: subErr } = await supabaseAdmin
          .from("prompt_game_submissions")
          .insert({
            session_id: sessionId,
            round_id: round.id,
            device_id: signalChoiceDeviceId(ch.id),
            raw_text: ch.label,
          })
          .select()
          .single();
        if (subErr || !sub) {
          return NextResponse.json(
            { error: subErr?.message || "Failed to seed choice submissions." },
            { status: 500 }
          );
        }
        submissionIds.push(sub.id as string);
      }
      const mergedChoices = prompt_block_parsed.choices.map((ch, i) => ({
        ...ch,
        submissionId: submissionIds[i],
      }));
      const mergedBlock = { ...prompt_block_parsed, choices: mergedChoices };
      const { error: upErr } = await supabaseAdmin
        .from("prompt_game_rounds")
        .update({ prompt_block: mergedBlock })
        .eq("id", round.id);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      await supabaseAdmin
        .from("prompt_game_sessions")
        .update({ state: "VOTING", current_round_id: round.id })
        .eq("id", sessionId);

      const { data: finalRow, error: fetchErr } = await supabaseAdmin
        .from("prompt_game_rounds")
        .select("*")
        .eq("id", round.id)
        .single();
      if (fetchErr || !finalRow) {
        return NextResponse.json(rowToRound({ ...round, prompt_block: mergedBlock }));
      }
      return NextResponse.json(rowToRound(finalRow));
    }

    await supabaseAdmin
      .from("prompt_game_sessions")
      .update({ state: "RESPONDING", current_round_id: round.id })
      .eq("id", sessionId);

    return NextResponse.json(rowToRound(round));
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
