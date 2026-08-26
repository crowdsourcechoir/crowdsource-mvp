import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { siteUrl } from "@/lib/site-url";
import { encryptSecret } from "@/lib/sales/gmail/crypto";
import { exchangeCodeForTokens, verifyOAuthState } from "@/lib/sales/gmail/oauth";
import { upsertGmailConnection } from "@/lib/sales/db/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function failRedirect(redirectBase: string, message: string) {
  return NextResponse.redirect(`${redirectBase}?gmail=error&message=${encodeURIComponent(message)}`);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const redirectBase = `${siteUrl()}/admin/sales`;

  if (oauthError) {
    return failRedirect(
      redirectBase,
      oauthError === "access_denied"
        ? "Google consent was cancelled. Click Connect Gmail, then Allow."
        : oauthError
    );
  }
  if (!code || !state) {
    return failRedirect(redirectBase, "Missing OAuth code/state");
  }

  // HMAC on state is the CSRF check. The cookie is extra; Safari / a long consent wait /
  // starting Connect on a preview host can drop it and used to fail after Allow.
  if (!verifyOAuthState(state)) {
    return failRedirect(redirectBase, "Invalid OAuth state. Click Connect Gmail again from this site, then Allow.");
  }
  const cookieState = cookies().get("gmail_oauth_state")?.value;
  if (cookieState && cookieState !== state) {
    return failRedirect(redirectBase, "Invalid OAuth state. Click Connect Gmail again from this site, then Allow.");
  }

  try {
    const { refreshToken, email, scopes } = await exchangeCodeForTokens(code);

    let lastErr: unknown;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        await upsertGmailConnection({
          email,
          refreshTokenEncrypted: encryptSecret(refreshToken),
          scopes,
          historyId: null,
        });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < 4) await sleep(1500 * attempt);
      }
    }
    if (lastErr) {
      const detail = lastErr instanceof Error && lastErr.message.trim() ? lastErr.message.trim() : "database timeout";
      throw new Error(
        `Google allowed access, but saving the connection failed (${detail}). Wait until Supabase is awake and click Connect Gmail again.`
      );
    }

    const res = NextResponse.redirect(`${redirectBase}?gmail=connected`);
    res.cookies.set("gmail_oauth_state", "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    const message = err instanceof Error && err.message.trim() ? err.message : "Gmail connect failed";
    return failRedirect(redirectBase, message);
  }
}
