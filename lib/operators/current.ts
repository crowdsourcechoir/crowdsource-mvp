import { cookies } from "next/headers";
import { OPERATOR_COOKIE, readActorToken } from "./session";
import type { Actor } from "./types";

export async function readActorFromCookies(): Promise<Actor | null> {
  const cookieStore = await cookies();
  return readActorToken(cookieStore.get(OPERATOR_COOKIE)?.value);
}

export async function readActorFromRequest(request: Request): Promise<Actor | null> {
  const header = request.headers.get("cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${OPERATOR_COOKIE}=([^;]+)`));
  if (!match) return null;
  return readActorToken(decodeURIComponent(match[1]));
}
