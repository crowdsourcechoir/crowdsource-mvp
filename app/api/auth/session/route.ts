import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createHmac } from "crypto";

const COOKIE_NAME = "root_auth";

function signToken(secret: string): string {
  return createHmac("sha256", secret).update("root").digest("hex");
}

export async function GET() {
  const password = process.env.ROOT_PAGE_PASSWORD;
  if (!password) {
    return NextResponse.json({ ok: true }); // no password set = no gate
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const expected = signToken(password);

  if (token && token === expected) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}
