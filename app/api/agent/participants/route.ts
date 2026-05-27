import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { localEventsGetById } from "@/lib/local-events-store";
import { localCreateOrGetParticipantAndConversation } from "@/lib/local-agent-interview-store";
import {
  participantDisplayName,
  participantInsertPayload,
  participantNameUpdatePayload,
} from "@/lib/agent-participant-db";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

function rowToParticipant(row: Record<string, unknown>) {
  const eventId = (row.local_event_id as string) ?? (row.event_id as string);
  return {
    id: row.id,
    eventId,
    displayName: participantDisplayName(row),
    email: row.email ?? null,
    sessionToken: row.session_token,
    createdAt: row.created_at,
  };
}

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

export async function POST(request: Request) {
  if (!supabaseAdmin && !USE_LOCAL_EVENTS) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const { eventId, displayName, email, sessionToken } = body as {
      eventId: string;
      displayName?: string;
      email?: string;
      sessionToken: string;
    };
    if (!eventId || !sessionToken || typeof sessionToken !== "string") {
      return NextResponse.json(
        { error: "eventId and sessionToken are required." },
        { status: 400 }
      );
    }
    const normalizedDisplayName = (displayName ?? "").trim() || null;
    const normalizedEmail = (email ?? "").trim().toLowerCase() || null;

    if (USE_LOCAL_EVENTS) {
      const local = localEventsGetById(eventId);
      if (!local) return NextResponse.json({ error: "Event not found." }, { status: 404 });

      const { participant, conversation } = await localCreateOrGetParticipantAndConversation({
        eventId,
        displayName: normalizedDisplayName,
        email: normalizedEmail,
        sessionToken,
      });

      return NextResponse.json({
        participant: rowToParticipant({
          ...participant,
          event_id: participant.eventId,
          local_event_id: participant.eventId,
          display_name: participant.displayName,
          email: participant.email,
          session_token: participant.sessionToken,
          created_at: participant.createdAt,
        } as any),
        conversation: rowToConversation({
          ...conversation,
          event_id: conversation.eventId,
          local_event_id: conversation.eventId,
          participant_id: conversation.participantId,
          created_at: conversation.createdAt,
          updated_at: conversation.updatedAt,
        } as any),
      });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Database not configured." }, { status: 503 });
    }

    const { data } = await supabaseAdmin
      .from("events")
      .select("id, agent_theme_id")
      .eq("id", eventId)
      .single();

    const eventRow = data as { id: string; agent_theme_id: string | null } | null;
    if (!eventRow?.id) return NextResponse.json({ error: "Event not found." }, { status: 404 });

    const isLocalEvent = USE_LOCAL_EVENTS && eventId.startsWith("local-");

    const { data: existingParticipant } = await supabaseAdmin
      .from("agent_participants")
      .select("id")
      .eq(isLocalEvent ? "local_event_id" : "event_id", eventId)
      .eq("session_token", sessionToken)
      .single();

    if (existingParticipant?.id) {
      if (normalizedDisplayName || normalizedEmail) {
        await supabaseAdmin
          .from("agent_participants")
          .update(participantNameUpdatePayload(normalizedDisplayName ?? ""))
          .eq("id", existingParticipant.id);
      }
      const { data: conv } = await supabaseAdmin
        .from("agent_conversations")
        .select("*")
        .eq("participant_id", existingParticipant.id)
        .single();
      if (conv) {
        const { data: p } = await supabaseAdmin
          .from("agent_participants")
          .select("*")
          .eq("id", existingParticipant.id)
          .single();
        if (p) {
          return NextResponse.json({
            participant: rowToParticipant(p),
            conversation: rowToConversation(conv),
          });
        }
      }
    }

    const { data: participant, error: errP } = await supabaseAdmin
      .from("agent_participants")
      .insert(
        participantInsertPayload({
          eventId: isLocalEvent ? null : eventId,
          localEventId: isLocalEvent ? eventId : null,
          displayName: normalizedDisplayName,
          sessionToken,
        })
      )
      .select()
      .single();
    if (errP || !participant) {
      if (errP?.code === "23505") {
        const { data: p } = await supabaseAdmin
          .from("agent_participants")
          .select("*")
          .eq(isLocalEvent ? "local_event_id" : "event_id", eventId)
          .eq("session_token", sessionToken)
          .single();
        const { data: c } = await supabaseAdmin
          .from("agent_conversations")
          .select("*")
          .eq("participant_id", p!.id)
          .single();
        if (p && c)
          return NextResponse.json({
            participant: rowToParticipant(p),
            conversation: rowToConversation(c),
          });
      }
      return NextResponse.json({ error: errP?.message ?? "Failed to create participant." }, { status: 400 });
    }

    const { data: conversation, error: errC } = await supabaseAdmin
      .from("agent_conversations")
      .insert({
        event_id: isLocalEvent ? null : eventId,
        local_event_id: isLocalEvent ? eventId : null,
        participant_id: participant.id,
      })
      .select()
      .single();
    if (errC || !conversation) {
      return NextResponse.json({ error: errC?.message ?? "Failed to create conversation." }, { status: 400 });
    }

    return NextResponse.json({
      participant: rowToParticipant(participant),
      conversation: rowToConversation(conversation),
    });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
