import { NextResponse } from "next/server";
import {
  isTurnstileClientConfigured,
  isTurnstileReady,
  isTurnstileServerConfigured,
} from "@/lib/turnstile";

export async function GET() {
  const client = isTurnstileClientConfigured();
  const server = isTurnstileServerConfigured();
  return NextResponse.json({
    client,
    server,
    ready: isTurnstileReady(),
    message: isTurnstileReady()
      ? "Turnstile is configured for email captcha."
      : !client && !server
        ? "Add NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY to .env.local, then restart the dev server."
        : !client
          ? "Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY (client widget will not appear)."
          : "Missing TURNSTILE_SECRET_KEY (server cannot verify captcha).",
  });
}
