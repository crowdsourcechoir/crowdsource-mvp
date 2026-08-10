import { requireSupabaseAdmin } from "./client";
import type { GmailConnection } from "../types";
import { GMAIL_OWNER_KEY } from "../gmail/constants";

function rowToConnection(row: Record<string, unknown>): GmailConnection {
  return {
    id: row.id as string,
    ownerKey: row.owner_key as string,
    email: row.email as string,
    refreshTokenEncrypted: row.refresh_token_encrypted as string,
    historyId: (row.history_id as string | null) ?? null,
    scopes: (row.scopes as string[] | null) ?? [],
    connectedAt: row.connected_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getGmailConnection(ownerKey: string = GMAIL_OWNER_KEY): Promise<GmailConnection | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("gmail_connections").select("*").eq("owner_key", ownerKey).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToConnection(data) : null;
}

/** Public status for UI — never exposes the refresh token. */
export async function getGmailConnectionStatus(ownerKey: string = GMAIL_OWNER_KEY): Promise<{
  connected: boolean;
  email: string | null;
  configured: boolean;
}> {
  const configured = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim() && process.env.GMAIL_TOKEN_ENCRYPTION_KEY?.trim()
  );
  if (!configured) return { connected: false, email: null, configured: false };
  const connection = await getGmailConnection(ownerKey);
  return { connected: Boolean(connection), email: connection?.email ?? null, configured: true };
}

export async function upsertGmailConnection(input: {
  ownerKey?: string;
  email: string;
  refreshTokenEncrypted: string;
  scopes: string[];
  historyId?: string | null;
}): Promise<GmailConnection> {
  const db = requireSupabaseAdmin();
  const ownerKey = input.ownerKey ?? GMAIL_OWNER_KEY;
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("gmail_connections")
    .upsert(
      {
        owner_key: ownerKey,
        email: input.email,
        refresh_token_encrypted: input.refreshTokenEncrypted,
        scopes: input.scopes,
        history_id: input.historyId ?? null,
        connected_at: now,
        updated_at: now,
      },
      { onConflict: "owner_key" }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToConnection(data);
}

export async function updateGmailHistoryId(connectionId: string, historyId: string): Promise<void> {
  const db = requireSupabaseAdmin();
  const { error } = await db
    .from("gmail_connections")
    .update({ history_id: historyId, updated_at: new Date().toISOString() })
    .eq("id", connectionId);
  if (error) throw new Error(error.message);
}

export async function deleteGmailConnection(ownerKey: string = GMAIL_OWNER_KEY): Promise<void> {
  const db = requireSupabaseAdmin();
  const { error } = await db.from("gmail_connections").delete().eq("owner_key", ownerKey);
  if (error) throw new Error(error.message);
}
