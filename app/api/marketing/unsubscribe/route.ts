import { NextResponse } from "next/server";
import { unsubscribePersonByEmail } from "@/lib/marketing/people";

export const dynamic = "force-dynamic";

async function handleUnsubscribe(email: string | null) {
  if (!email) {
    return new NextResponse("Missing email.", { status: 400, headers: { "Content-Type": "text/plain" } });
  }
  const person = await unsubscribePersonByEmail(email);
  const msg = person
    ? `You have been unsubscribed (${person.email}).`
    : "If that address was on our list, it has been unsubscribed.";
  return new NextResponse(
    `<!doctype html><html><body style="background:#000;color:#fff;font-family:sans-serif;padding:40px"><h1 style="color:#CFFF81">Unsubscribed</h1><p>${msg}</p></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: Request) {
  const email = new URL(request.url).searchParams.get("email");
  return handleUnsubscribe(email);
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let email: string | null = null;
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { email?: string } | null;
    email = body?.email ?? null;
  } else {
    const form = await request.formData().catch(() => null);
    const value = form?.get("email");
    email = typeof value === "string" ? value : new URL(request.url).searchParams.get("email");
  }
  return handleUnsubscribe(email);
}
