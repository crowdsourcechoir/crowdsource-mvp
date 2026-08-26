import { requireSupabaseAdmin } from "./client";
import type { GmailConnection } from "../types";
import { GMAIL_OWNER_KEY, hasSendsEnabledMarker, withSendsEnabledMarker } from "../gmail/constants";
import { gmailSendsAllowed } from "../outreach/send-guard";

function supabaseErrorMessage(error: { message?: string; details?: string; hint?: string; code?: string } | null): string {
  if (!error) return "Database error";
  return error.message || error.details || error.hint || error.code || "Database error";
}

function rowToConnection(row: Record<string, unknown>): GmailConnection {
  return {
    id: row.id as string,
    ownerKey: row.owner_key as string,
    email: row.email as string,
    refreshTokenEncrypted: row.refresh_token_encrypted as string,
    historyId: (row.history_id as string | null) ?? null,
    scopes: (row.scopes as string[] | null) ?? [],
    sendsEnabled: row.sends_enabled === true || hasSendsEnabledMarker(row.scopes as string[] | null),
    connectedAt: row.connected_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getGmailConnection(ownerKey: string = GMAIL_OWNER_KEY): Promise<GmailConnection | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("gmail_connections").select("*").eq("owner_key", ownerKey).maybeSingle();
  if (error) throw new Error(supabaseErrorMessage(error));
  return data ? rowToConnection(data) : null;
}

/** Public status for UI — never exposes the refresh token. */
export async function getGmailConnectionStatus(ownerKey: string = GMAIL_OWNER_KEY): Promise<{
  connected: boolean;
  email: string | null;
  configured: boolean;
  sendsEnabled: boolean;
  error?: string | null;
}> {
  const configured = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim() && process.env.GMAIL_TOKEN_ENCRYPTION_KEY?.trim()
  );
  if (!configured) {
    return {
      connected: false,
      email: null,
      configured: false,
      sendsEnabled: gmailSendsAllowed({
        envFlag: process.env.SALES_GMAIL_SENDS_ENABLED,
        connectionSendsEnabled: false,
      }),
    };
  }
  try {
    const connection = await getGmailConnection(ownerKey);
    const sendsEnabled = gmailSendsAllowed({
      envFlag: process.env.SALES_GMAIL_SENDS_ENABLED,
      connectionSendsEnabled: connection?.sendsEnabled ?? false,
    });
    return { connected: Boolean(connection), email: connection?.email ?? null, configured: true, sendsEnabled };
  } catch (err) {
    const detail = err instanceof Error && err.message.trim() ? err.message.trim() : "connection timed out";
    return {
      connected: false,
      email: null,
      configured: true,
      sendsEnabled: gmailSendsAllowed({
        envFlag: process.env.SALES_GMAIL_SENDS_ENABLED,
        connectionSendsEnabled: false,
      }),
      error: `Can't reach the database (${detail}). OAuth is configured — wait a minute and click Connect Gmail again.`,
    };
  }
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
  if (error) throw new Error(supabaseErrorMessage(error));
  return rowToConnection(data);
}

export async function updateGmailHistoryId(connectionId: string, historyId: string): Promise<void> {
  const db = requireSupabaseAdmin();
  const { error } = await db
    .from("gmail_connections")
    .update({ history_id: historyId, updated_at: new Date().toISOString() })
    .eq("id", connectionId);
  if (error) throw new Error(supabaseErrorMessage(error));
}

export async function deleteGmailConnection(ownerKey: string = GMAIL_OWNER_KEY): Promise<void> {
  const db = requireSupabaseAdmin();
  const { error } = await db.from("gmail_connections").delete().eq("owner_key", ownerKey);
  if (error) throw new Error(supabaseErrorMessage(error));
}

/** Pause or resume outbound Gmail without disconnecting OAuth. */
export async function setGmailSendsEnabled(
  enabled: boolean,
  ownerKey: string = GMAIL_OWNER_KEY
): Promise<{ connected: boolean; email: string | null; configured: boolean; sendsEnabled: boolean }> {
  const connection = await getGmailConnection(ownerKey);
  if (!connection) {
    throw new Error("Gmail is not connected. Connect Gmail first, then Resume sending.");
  }

  const db = requireSupabaseAdmin();
  const now = new Date().toISOString();
  const scopes = withSendsEnabledMarker(connection.scopes, enabled);
  const withColumn = await db
    .from("gmail_connections")
    .update({ sends_enabled: enabled, scopes, updated_at: now })
    .eq("owner_key", ownerKey)
    .select("id")
    .maybeSingle();

  if (withColumn.error && /sends_enabled/i.test(supabaseErrorMessage(withColumn.error))) {
    const withoutColumn = await db
      .from("gmail_connections")
      .update({ scopes, updated_at: now })
      .eq("owner_key", ownerKey)
      .select("id")
      .maybeSingle();
    if (withoutColumn.error) throw new Error(supabaseErrorMessage(withoutColumn.error));
    if (!withoutColumn.data) {
      throw new Error("Gmail is not connected. Connect Gmail first, then Resume sending.");
    }
    return getGmailConnectionStatus(ownerKey);
  }

  if (withColumn.error) throw new Error(supabaseErrorMessage(withColumn.error));
  if (!withColumn.data) {
    throw new Error("Gmail is not connected. Connect Gmail first, then Resume sending.");
  }
  return getGmailConnectionStatus(ownerKey);
}
