import type { Actor } from "./types";

export const OPERATOR_COOKIE = "root_auth";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export function sessionSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.ROOT_PAGE_PASSWORD?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToHex(sig);
}

export async function legacyOwnerToken(secret: string): Promise<string> {
  return hmacHex(secret, "root");
}

export async function signActor(actor: Omit<Actor, "legacy">): Promise<string> {
  const secret = sessionSecret();
  if (!secret) throw new Error("Sign-in is not configured.");
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = base64UrlEncode(JSON.stringify({ ...actor, legacy: false, exp }));
  const sig = await hmacHex(secret, payload);
  return `v1.${payload}.${sig}`;
}

export async function readActorToken(token: string | undefined | null): Promise<Actor | null> {
  if (!token) return null;
  const secret = sessionSecret();
  if (!secret) return null;

  if (!token.startsWith("v1.")) {
    const expected = await legacyOwnerToken(secret);
    if (token.length !== expected.length) return null;
    let mismatch = 0;
    for (let i = 0; i < token.length; i += 1) mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i);
    if (mismatch !== 0) return null;
    return {
      id: "legacy-owner",
      email: ownerEmail(),
      name: "Owner",
      role: "owner",
      sessionVersion: 0,
      legacy: true,
      sales: true,
      stewardBlooms: [],
      composeBlooms: [],
      stewardGardens: [],
      composeGardens: [],
    };
  }

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = parts[1];
  const sig = parts[2];
  const expected = await hmacHex(secret, payload);
  if (expected.length !== sig.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (mismatch !== 0) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as Actor & { exp?: number };
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    if (!parsed.id || (parsed.role !== "owner" && parsed.role !== "member")) return null;
    return {
      id: parsed.id,
      email: parsed.email,
      name: parsed.name,
      role: parsed.role,
      sessionVersion: Number(parsed.sessionVersion) || 1,
      legacy: false,
      sales: Boolean(parsed.sales) || parsed.role === "owner",
      stewardBlooms: Array.isArray(parsed.stewardBlooms) ? parsed.stewardBlooms : [],
      composeBlooms: Array.isArray(parsed.composeBlooms) ? parsed.composeBlooms : [],
      stewardGardens: Array.isArray(parsed.stewardGardens) ? parsed.stewardGardens : [],
      composeGardens: Array.isArray(parsed.composeGardens) ? parsed.composeGardens : [],
    };
  } catch {
    return null;
  }
}

export function ownerEmail(): string {
  return process.env.OPERATOR_OWNER_EMAIL?.trim() || "sing@crowdsourcechoir.com";
}

export function cookieMaxAge(): number {
  return SESSION_TTL_SECONDS;
}
