import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ROOT_AUTH_COOKIE_NAME, resetRootPagePassword } from "@/lib/root-page-auth";

function isLocalHostHostHeader(hostHeader: string | null): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.toLowerCase();
  return (
    host.startsWith("localhost:") ||
    host === "localhost" ||
    host.startsWith("127.0.0.1:") ||
    host === "127.0.0.1" ||
    host.startsWith("[::1]:") ||
    host === "[::1]"
  );
}

export async function POST(request: Request) {
  // This is intentionally local-only so you can recover access on your machine
  // without needing to know the previous password.
  const nodeEnv = process.env.NODE_ENV as string | undefined;
  const hostHeader = request.headers.get("host");
  if (nodeEnv === "production" || !isLocalHostHostHeader(hostHeader)) {
    return NextResponse.json({ error: "Password reset is disabled." }, { status: 403 });
  }

  let body: { newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const newPassword = body?.newPassword;
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  await resetRootPagePassword(newPassword);

  // Clear existing auth cookie (forces re-login with the new password).
  const cookieStore = await cookies();
  cookieStore.set(ROOT_AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ success: true });
}

