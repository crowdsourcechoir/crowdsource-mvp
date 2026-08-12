import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function redirectThresholdsEvent(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;
  if (
    pathname === "/e/thresholds" ||
    pathname === "/e/thresholds/world" ||
    pathname === "/e/thresholds/songgarden"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/e/csc-oct8";
    url.search = search;
    return NextResponse.redirect(url, 308);
  }

  return null;
}

/**
 * Handles edge-level canonical redirects and keeps Next emitting
 * `middleware-manifest.json` in dev (avoids missing-manifest errors when
 * `.next` was partially cleared).
 */
export function middleware(request: NextRequest) {
  const eventRedirect = redirectThresholdsEvent(request);
  if (eventRedirect) return eventRedirect;

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
