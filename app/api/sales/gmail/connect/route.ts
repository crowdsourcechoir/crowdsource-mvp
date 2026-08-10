import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildConnectUrl, gmailConfigured, signOAuthState } from "@/lib/sales/gmail/oauth";

export const dynamic = "force-dynamic";

/** Starts the Google OAuth flow; redirects the browser to Google's consent screen. */
export async function GET() {
  try {
    if (!gmailConfigured()) {
      return NextResponse.json(
        {
          error:
            "Gmail OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GMAIL_TOKEN_ENCRYPTION_KEY.",
        },
        { status: 503 }
      );
    }
    const nonce = randomBytes(16).toString("base64url");
    const state = signOAuthState(nonce);
    const url = buildConnectUrl(state);
    const res = NextResponse.redirect(url);
    res.cookies.set("gmail_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
