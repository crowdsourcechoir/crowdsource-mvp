import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Passthrough middleware. Ensures Next always emits `middleware-manifest.json`
 * in dev (avoids missing-manifest errors when `.next` was partially cleared).
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Skip static assets and Next internals (same default intent as typical apps).
     */
    "/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
