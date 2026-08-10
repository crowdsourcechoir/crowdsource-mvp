import { createHmac, timingSafeEqual } from "crypto";
import { google } from "googleapis";
import { siteUrl } from "@/lib/site-url";
import { GMAIL_SCOPES } from "./constants";

function clientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!id) throw new Error("GOOGLE_CLIENT_ID is not set.");
  return id;
}

function clientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET is not set.");
  return secret;
}

function stateSecret(): string {
  return (
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.ROOT_PAGE_PASSWORD?.trim() ||
    ""
  );
}

export function gmailConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim() && process.env.GMAIL_TOKEN_ENCRYPTION_KEY?.trim());
}

export function gmailRedirectUri(): string {
  const override = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (override) return override.replace(/\/$/, "");
  return `${siteUrl()}/api/sales/gmail/callback`;
}

export function createOAuth2Client(redirectUri?: string) {
  return new google.auth.OAuth2(clientId(), clientSecret(), redirectUri ?? gmailRedirectUri());
}

export function buildConnectUrl(state: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GMAIL_SCOPES],
    state,
  });
}

/** HMAC-signed OAuth state so the callback can reject CSRF / forged redirects. */
export function signOAuthState(nonce: string): string {
  const secret = stateSecret();
  if (!secret) throw new Error("No secret available to sign Gmail OAuth state (set GMAIL_TOKEN_ENCRYPTION_KEY).");
  const sig = createHmac("sha256", secret).update(nonce).digest("base64url");
  return `${nonce}.${sig}`;
}

export function verifyOAuthState(state: string): boolean {
  const secret = stateSecret();
  if (!secret) return false;
  const [nonce, sig] = state.split(".");
  if (!nonce || !sig) return false;
  const expected = createHmac("sha256", secret).update(nonce).digest("base64url");
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function exchangeCodeForTokens(code: string): Promise<{
  refreshToken: string;
  email: string;
  scopes: string[];
}> {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh token. Disconnect the app in your Google account and try Connect again with consent.");
  }
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const me = await oauth2.userinfo.get();
  const email = me.data.email;
  if (!email) throw new Error("Could not read the Gmail account email from Google.");
  const scopes = (tokens.scope ?? "").split(/\s+/).filter(Boolean);
  return { refreshToken: tokens.refresh_token, email, scopes };
}
