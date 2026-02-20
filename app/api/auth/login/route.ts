import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createHmac } from "crypto";

const COOKIE_NAME = "root_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function signToken(secret: string): string {
  return createHmac("sha256", secret).update("root").digest("hex");
}

export async function POST(request: Request) {
  const password = process.env.ROOT_PAGE_PASSWORD;
  if (!password) {
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

  if (submitted !== password) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = signToken(password);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return NextResponse.json({ success: true });
}
