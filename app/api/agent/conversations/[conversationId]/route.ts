import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { localGetConversation } from "@/lib/local-agent-interview-store";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

function rowToConversation(row: Record<string, unknown>) {
  const eventId = (row.local_event_id as string) ?? (row.event_id as string);
  return {
    id: row.id,
    eventId,
    participantId: row.participant_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToTurn(row: Record<string, unknown>) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    turnIndex: row.turn_index,
    role: row.role,
    content: row.content,
    audioUrl: row.audio_url ?? null,
    videoUrl: row.video_url ?? null,
    createdAt: row.created_at,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  if (USE_LOCAL_EVENTS) {
    const { conversationId } = await params;
    const local = await localGetConversation(conversationId);
    if (!local) return NextResponse.json(null, { status: 404 });
    return NextResponse.json({
      conversation: {
        id: local.conversation.id,
        eventId: local.conversation.eventId,
        participantId: local.conversation.participantId,
        createdAt: local.conversation.createdAt,
        updatedAt: local.conversation.updatedAt,
      },
      turns: local.turns.map((t) => ({
        id: t.id,
        conversationId: t.conversationId,
        turnIndex: t.turnIndex,
        role: t.role,
        content: t.content,
        audioUrl: t.audioUrl,
        videoUrl: t.videoUrl,
        createdAt: t.createdAt,
      })),
    });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { conversationId } = await params;
  try {
    const { data: conv, error: eConv } = await supabaseAdmin
      .from("agent_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();
    if (eConv || !conv) {
      if (eConv?.code === "PGRST116") return NextResponse.json(null, { status: 404 });
      return NextResponse.json({ error: eConv?.message ?? "Not found" }, { status: 500 });
    }

    const { data: turns, error: eTurns } = await supabaseAdmin
      .from("agent_conversation_turns")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("turn_index", { ascending: true });
    if (eTurns) return NextResponse.json({ error: eTurns.message }, { status: 500 });

    return NextResponse.json({
      conversation: rowToConversation(conv),
      turns: (turns ?? []).map(rowToTurn),
    });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
