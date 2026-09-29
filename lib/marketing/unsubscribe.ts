import { createHmac, timingSafeEqual } from "node:crypto";

export type UnsubscribeClaim =
  | { kind: "test"; email: string }
  | { kind: "live"; personId: string; subscriptionId: string };

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function testUnsubscribeToken(email: string, secret: string): string {
  const body = `test.${email.trim().toLowerCase()}`;
  return `${body}.${sign(body, secret)}`;
}

export function liveUnsubscribeToken(personId: string, subscriptionId: string, secret: string): string {
  const body = `live.${personId}.${subscriptionId}`;
  return `${body}.${sign(body, secret)}`;
}

export function verifyUnsubscribeToken(token: string, secret: string): UnsubscribeClaim | null {
  const value = token.trim();
  const split = value.lastIndexOf(".");
  if (split <= 0 || !secret) return null;
  const body = value.slice(0, split);
  const signature = value.slice(split + 1);
  if (!safeEqual(signature, sign(body, secret))) return null;
  if (body.startsWith("test.")) {
    const email = body.slice("test.".length);
    if (!email.includes("@")) return null;
    return { kind: "test", email };
  }
  const parts = body.split(".");
  if (parts.length !== 3 || parts[0] !== "live" || !parts[1] || !parts[2]) return null;
  return { kind: "live", personId: parts[1], subscriptionId: parts[2] };
}

export function unsubscribeUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`;
}
