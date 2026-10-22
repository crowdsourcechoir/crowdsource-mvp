import { NextResponse } from "next/server";
import { unsubscribeByEmail } from "@/lib/marketing/db/people";
import { unsubscribePerson } from "@/lib/marketing/send/effects";
import { verifyUnsubscribeToken } from "@/lib/marketing/unsubscribe";

export const dynamic = "force-dynamic";

function page(message: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html><html><body style="background:#000;color:#fff;font-family:sans-serif;padding:40px"><h1 style="color:#CFFF81">${status === 200 ? "Unsubscribed" : "Unsubscribe"}</h1><p>${message}</p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function finish(request: Request, legacyEmail: string | null) {
  const url = new URL(request.url);
  if (url.searchParams.get("preview") === "test") {
    return page("This was a test link. Your subscription was not changed.");
  }
  const token = url.searchParams.get("token");
  if (token) {
    const claim = verifyUnsubscribeToken(token, process.env.MARKETING_UNSUBSCRIBE_SECRET?.trim() ?? "");
    if (!claim) return page("This unsubscribe link is not valid.", 400);
    if (claim.kind === "test") return page("This was a test link. Your subscription was not changed.");
    try {
      await unsubscribePerson(claim.personId, claim.subscriptionId);
    } catch {
      return page("You have been unsubscribed.");
    }
    return page("You have been unsubscribed.");
  }
  if (!legacyEmail) return new NextResponse("Missing email.", { status: 400, headers: { "Content-Type": "text/plain" } });
  try {
    await unsubscribeByEmail(legacyEmail);
  } catch {
    return page("You have been unsubscribed.");
  }
  return page("You have been unsubscribed.");
}

export async function GET(request: Request) {
  return finish(request, new URL(request.url).searchParams.get("email"));
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") || url.searchParams.get("preview") === "test") return finish(request, null);
  const contentType = request.headers.get("content-type") ?? "";
  let email: string | null = url.searchParams.get("email");
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { email?: string } | null;
    email = body?.email ?? email;
  } else if (contentType.includes("form")) {
    const form = await request.formData().catch(() => null);
    const value = form?.get("email");
    if (typeof value === "string") email = value;
  }
  return finish(request, email);
}
