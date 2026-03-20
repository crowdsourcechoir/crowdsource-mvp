import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ROOT_AUTH_COOKIE_NAME,
  getRootAuthExpectedToken,
  hasRootAuthPasswordConfigured,
  verifyRootPagePassword,
} from "@/lib/root-page-auth";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(request: Request) {
  if (!(await hasRootAuthPasswordConfigured())) {
    return NextResponse.json(
      { error: "Login not configured. Set ROOT_PAGE_PASSWORD in .env.local." },
      { status: 503 }
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const submitted = body.password;
  if (typeof submitted !== "string") {
    return NextResponse.json({ error: "Missing password" }, { status: 400 });
  }

  const ok = await verifyRootPagePassword(submitted);
  if (!ok) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await getRootAuthExpectedToken();
  if (!token) {
    return NextResponse.json({ error: "Login not configured" }, { status: 503 });
  }
  const cookieStore = await cookies();
  cookieStore.set(ROOT_AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return NextResponse.json({ success: true });
}
