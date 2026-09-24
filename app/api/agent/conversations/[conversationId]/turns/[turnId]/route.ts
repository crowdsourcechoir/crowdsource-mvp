import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { localDeleteTurn, localGetConversation } from "@/lib/local-agent-interview-store";
import {
  AGENT_MEDIA_BUCKET,
  agentMediaPathFromUrlOrPath,
} from "@/lib/agent-media/storage-upload";

export const dynamic = "force-dynamic";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

/**
 * DELETE one user contribution (interview turn). Agent prompts stay.
 * Storage objects for that turn are removed when the URL maps to agent-media.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ conversationId: string; turnId: string }> }
) {
  const { conversationId, turnId } = await context.params;
  const conversation = conversationId?.trim() ?? "";
  const turn = turnId?.trim() ?? "";
  if (!conversation || !turn) {
    return NextResponse.json({ error: "conversationId and turnId are required." }, { status: 400 });
  }

  if (USE_LOCAL_EVENTS) {
    const existing = await localGetConversation(conversation);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const ok = await localDeleteTurn(conversation, turn);
    if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  try {
    const { data: row, error } = await supabaseAdmin
      .from("agent_conversation_turns")
      .select("id, role, audio_url, video_url")
      .eq("id", turn)
      .eq("conversation_id", conversation)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!row || row.role !== "user") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const paths = [row.audio_url, row.video_url]
      .map((url) => (typeof url === "string" ? agentMediaPathFromUrlOrPath(url) : null))
      .filter((path): path is string => Boolean(path));
    if (paths.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from(AGENT_MEDIA_BUCKET)
        .remove(paths);
      if (storageError) {
        console.warn("Contribution media cleanup:", storageError.message);
      }
    }

    const { error: deleteError, count } = await supabaseAdmin
      .from("agent_conversation_turns")
      .delete({ count: "exact" })
      .eq("id", turn)
      .eq("conversation_id", conversation)
      .eq("role", "user");

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    if (count === 0) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Contribution DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
