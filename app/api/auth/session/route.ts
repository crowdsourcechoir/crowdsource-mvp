import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ROOT_AUTH_COOKIE_NAME,
  getRootAuthExpectedToken,
  hasRootAuthPasswordConfigured,
} from "@/lib/root-page-auth";

export async function GET() {
  if (!(await hasRootAuthPasswordConfigured())) return NextResponse.json({ ok: true }); // no password set = no gate

  const cookieStore = await cookies();
  const token = cookieStore.get(ROOT_AUTH_COOKIE_NAME)?.value;
  const expected = await getRootAuthExpectedToken();

  if (token && expected && token === expected) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}
