import { google, calendar_v3 } from "googleapis";
import { getGmailConnection } from "../db/gmail";
import { decryptSecret } from "../gmail/crypto";
import { createOAuth2Client, gmailConfigured } from "../gmail/oauth";
import { GMAIL_OWNER_KEY } from "../gmail/constants";
import { hasCalendarReadonlyScope } from "./constants";

export type CalendarClientBundle = {
  calendar: calendar_v3.Calendar;
  email: string;
  scopes: string[];
  connectionId: string;
  calendarGranted: boolean;
};

/** Authenticated Calendar client using the same Google connection as Gmail. */
export async function getCalendarClient(
  ownerKey: string = GMAIL_OWNER_KEY
): Promise<CalendarClientBundle | null> {
  if (!gmailConfigured()) return null;
  const connection = await getGmailConnection(ownerKey);
  if (!connection) return null;

  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: decryptSecret(connection.refreshTokenEncrypted) });
  const calendar = google.calendar({ version: "v3", auth: client });
  return {
    calendar,
    email: connection.email,
    scopes: connection.scopes,
    connectionId: connection.id,
    calendarGranted: hasCalendarReadonlyScope(connection.scopes),
  };
}
