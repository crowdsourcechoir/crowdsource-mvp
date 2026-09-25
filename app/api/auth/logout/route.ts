import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE } from "@/lib/operators/session";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(OPERATOR_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
