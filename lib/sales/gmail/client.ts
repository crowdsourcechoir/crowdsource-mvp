import { google, gmail_v1 } from "googleapis";
import { getGmailConnection, updateGmailHistoryId } from "../db/gmail";
import { decryptSecret } from "./crypto";
import { createOAuth2Client, gmailConfigured } from "./oauth";
import { GMAIL_OWNER_KEY } from "./constants";

export type GmailClientBundle = {
  gmail: gmail_v1.Gmail;
  email: string;
  historyId: string | null;
  connectionId: string;
};

/** Returns an authenticated Gmail client for the default operator, or null if not connected / not configured. */
export async function getGmailClient(ownerKey: string = GMAIL_OWNER_KEY): Promise<GmailClientBundle | null> {
  if (!gmailConfigured()) return null;
  const connection = await getGmailConnection(ownerKey);
  if (!connection) return null;

  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: decryptSecret(connection.refreshTokenEncrypted) });
  const gmail = google.gmail({ version: "v1", auth: client });
  return {
    gmail,
    email: connection.email,
    historyId: connection.historyId,
    connectionId: connection.id,
  };
}

export async function persistHistoryId(connectionId: string, historyId: string | null | undefined): Promise<void> {
  if (!historyId) return;
  await updateGmailHistoryId(connectionId, historyId);
}
