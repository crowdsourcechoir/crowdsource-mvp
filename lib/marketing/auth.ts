import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getRootAuthExpectedToken, hasRootAuthPasswordConfigured, ROOT_AUTH_COOKIE_NAME } from "@/lib/root-page-auth";
import { decideRootAuth } from "./auth-decision";
import { MarketingDbError } from "./db/errors";

export async function requireRootPageAuth(): Promise<NextResponse | null> {
  const passwordConfigured = await hasRootAuthPasswordConfigured();
  const token = (await cookies()).get(ROOT_AUTH_COOKIE_NAME)?.value;
  const expected = passwordConfigured ? await getRootAuthExpectedToken() : null;
  if (decideRootAuth({ passwordConfigured, token, expected }) === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function marketingErrorResponse(err: unknown): NextResponse {
  if (err instanceof MarketingDbError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Request failed";
  const status = /invalid email document|unsupported|segment/i.test(message) ? 400 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function withMarketingAuth(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  const denied = await requireRootPageAuth();
  if (denied) return denied;
  try {
    return await handler();
  } catch (err) {
    return marketingErrorResponse(err);
  }
}
