import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decideAccess } from "@/lib/operators/access";
import { checkSessionVersion } from "@/lib/operators/session-check";
import { OPERATOR_COOKIE, readActorToken, sessionSecret } from "@/lib/operators/session";

async function actorStillValid(token: string) {
  const actor = await readActorToken(token);
  if (!actor) return null;
  if (actor.legacy || actor.id === "legacy-owner") return actor;
  const check = await checkSessionVersion(actor.id, actor.sessionVersion);
  if (check.state === "reject") return null;
  return actor;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (!sessionSecret() && !(process.env.ROOT_PAGE_PASSWORD?.trim())) {
    return NextResponse.next();
  }

  const decisionPreview = decideAccess(pathname, request.method, searchParams, null);
  if (decisionPreview.kind === "public") return NextResponse.next();

  const token = request.cookies.get(OPERATOR_COOKIE)?.value;
  const actor = token ? await actorStillValid(token) : null;
  const decision = decideAccess(pathname, request.method, searchParams, actor);

  if (decision.kind === "public" || decision.kind === "allow") return NextResponse.next();
  if (decision.kind === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = decision.to.split("?")[0] || "/";
    const query = decision.to.includes("?") ? decision.to.slice(decision.to.indexOf("?") + 1) : "";
    url.search = query ? `?${query}` : "";
    return NextResponse.redirect(url);
  }
  return NextResponse.json({ error: decision.status === 401 ? "Sign in required." : "You do not have access to that." }, { status: decision.status });
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm)$).*)"],
};
