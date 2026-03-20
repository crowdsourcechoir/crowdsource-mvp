import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

function rowToTheme(row: Record<string, unknown>) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    tone: row.tone ?? "warm",
    questionGoals: Array.isArray(row.question_goals) ? row.question_goals : [],
    maxQuestions: typeof row.max_questions === "number" ? row.max_questions : 8,
    doDontRules: Array.isArray(row.do_dont_rules) ? row.do_dont_rules : [],
    systemPromptTemplate: (row.system_prompt_template as string) ?? "",
    createdAt: row.created_at,
  };
}

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  try {
    const { data, error } = await supabaseAdmin
      .from("agent_themes")
      .select("*")
      .order("key");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data ?? []).map(rowToTheme));
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
