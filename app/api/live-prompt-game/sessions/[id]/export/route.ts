import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

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
  const format = searchParams.get("format") || "csv";

  try {
    const { data: rows, error } = await supabaseAdmin
      .from("prompt_game_submissions")
      .select("id, round_id, device_id, raw_text, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (format === "csv") {
      const header = "session_id,round_id,submission_id,device_id,raw_text,created_at\n";
      const body = (rows ?? [])
        .map(
          (r) =>
            `${sessionId},${r.round_id},${r.id},${escapeCsv(r.device_id ?? "")},${escapeCsv(r.raw_text ?? "")},${r.created_at ?? ""}`
        )
        .join("\n");
      const csv = header + body;
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="live-prompt-game-${sessionId}-raw.csv"`,
        },
      });
    }

    return NextResponse.json({ error: "format must be csv" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
