import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { siteUrl } from "@/lib/site-url";
import { encryptSecret } from "@/lib/sales/gmail/crypto";
import { exchangeCodeForTokens, verifyOAuthState } from "@/lib/sales/gmail/oauth";
import { upsertGmailConnection } from "@/lib/sales/db/gmail";
import { createOAuth2Client } from "@/lib/sales/gmail/oauth";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const redirectBase = `${siteUrl()}/admin/sales`;

  if (oauthError) {
    return NextResponse.redirect(`${redirectBase}?gmail=error&message=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${redirectBase}?gmail=error&message=${encodeURIComponent("Missing OAuth code/state")}`);
  }

  const cookieState = cookies().get("gmail_oauth_state")?.value;
  if (!cookieState || cookieState !== state || !verifyOAuthState(state)) {
    return NextResponse.redirect(`${redirectBase}?gmail=error&message=${encodeURIComponent("Invalid OAuth state")}`);
  }

  try {
    const { refreshToken, email, scopes } = await exchangeCodeForTokens(code);

    // Seed historyId so the first sync cron has a baseline.
    let historyId: string | null = null;
    try {
      const client = createOAuth2Client();
      client.setCredentials({ refresh_token: refreshToken });
      const gmail = google.gmail({ version: "v1", auth: client });
      const profile = await gmail.users.getProfile({ userId: "me" });
      historyId = profile.data.historyId ?? null;
    } catch {
      // Non-fatal — sync cron will establish historyId later.
    }

    await upsertGmailConnection({
      email,
      refreshTokenEncrypted: encryptSecret(refreshToken),
      scopes,
      historyId,
    });

    const res = NextResponse.redirect(`${redirectBase}?gmail=connected`);
    res.cookies.set("gmail_oauth_state", "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail connect failed";
    return NextResponse.redirect(`${redirectBase}?gmail=error&message=${encodeURIComponent(message)}`);
  }
}
