import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyRootPagePassword, hasRootAuthPasswordConfigured } from "@/lib/root-page-auth";
import { navAccess, homePath } from "@/lib/operators/access";
import { authMailReady } from "@/lib/operators/mail";
import { OPERATOR_COOKIE, cookieMaxAge, signActor } from "@/lib/operators/session";
import { OperatorsUnavailableError, actorFromOperator, authenticate, ensureOwner } from "@/lib/operators/store";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const password = body.password;
  const email = body.email?.trim().toLowerCase() || "";
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Missing password" }, { status: 400 });
  }

  try {
    let person = email ? await authenticate(email, password) : null;
    if (!person && (await verifyRootPagePassword(password))) {
      person = await ensureOwner(password);
    }
    if (!person) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    const actor = await actorFromOperator(person);
    const token = await signActor(actor);
    const cookieStore = await cookies();
    cookieStore.set(OPERATOR_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: cookieMaxAge(),
    });
    return NextResponse.json({
      success: true,
      home: homePath({ ...actor, legacy: false }),
      nav: navAccess({ ...actor, legacy: false }),
    });
  } catch (err) {
    if (err instanceof OperatorsUnavailableError) {
      if (!(await hasRootAuthPasswordConfigured()) || !(await verifyRootPagePassword(password))) {
        return NextResponse.json({ error: err.message }, { status: 503 });
      }
      const { getRootAuthExpectedToken, ROOT_AUTH_COOKIE_NAME } = await import("@/lib/root-page-auth");
      const token = await getRootAuthExpectedToken();
      if (!token) return NextResponse.json({ error: err.message }, { status: 503 });
      const cookieStore = await cookies();
      cookieStore.set(ROOT_AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: cookieMaxAge(),
      });
      return NextResponse.json({ success: true, home: "/admin/gardens", legacy: true, mailReady: authMailReady() });
    }
    const message = err instanceof Error ? err.message : "Sign-in failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
