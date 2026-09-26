import { cookies } from "next/headers";
import {
  ROOT_AUTH_COOKIE_NAME,
  getRootAuthExpectedToken,
  hasRootAuthPasswordConfigured,
} from "@/lib/root-page-auth";
import { OPERATOR_COOKIE, readActorToken } from "./session";
import type { Actor } from "./types";

export async function readActorFromCookies(): Promise<Actor | null> {
  const cookieStore = await cookies();
  return readActorToken(cookieStore.get(OPERATOR_COOKIE)?.value);
}

/** Owner session, including the older root cookie. Open only when no password is configured. */
export async function signedInOwner(): Promise<boolean> {
  const actor = await readActorFromCookies();
  if (actor?.role === "owner") return true;
  if (!(await hasRootAuthPasswordConfigured())) return true;
  const token = (await cookies()).get(ROOT_AUTH_COOKIE_NAME)?.value;
  const expected = await getRootAuthExpectedToken();
  return Boolean(token && expected && token === expected);
}

export async function readActorFromRequest(request: Request): Promise<Actor | null> {
  const header = request.headers.get("cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${OPERATOR_COOKIE}=([^;]+)`));
  if (!match) return null;
  return readActorToken(decodeURIComponent(match[1]));
}
