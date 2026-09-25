import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { homePath } from "@/lib/operators/access";
import { OPERATOR_COOKIE, cookieMaxAge, signActor } from "@/lib/operators/session";
import { OperatorsUnavailableError, actorFromOperator, consumeToken } from "@/lib/operators/store";

export async function POST(request: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = body.token?.trim() || "";
  const password = body.password || "";
  if (!token) return NextResponse.json({ error: "Missing invite link." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Use at least 8 characters." }, { status: 400 });

  try {
    const person = await consumeToken(token, "invite", password);
    const actor = await actorFromOperator(person);
    const session = await signActor(actor);
    const cookieStore = await cookies();
    cookieStore.set(OPERATOR_COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: cookieMaxAge(),
    });
    return NextResponse.json({ ok: true, home: homePath({ ...actor, legacy: false }) });
  } catch (err) {
    if (err instanceof OperatorsUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Could not accept the invite.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
