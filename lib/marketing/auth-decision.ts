import { timingSafeEqual } from "crypto";

export type RootAuthDecision = "allow" | "unauthorized";

export function decideRootAuth(input: {
  passwordConfigured: boolean;
  token: string | undefined;
  expected: string | null;
}): RootAuthDecision {
  if (!input.passwordConfigured) return "allow";
  if (!input.expected) return "unauthorized";
  const provided = Buffer.from(input.token ?? "");
  const expected = Buffer.from(input.expected);
  if (provided.length !== expected.length || provided.length === 0) return "unauthorized";
  if (!timingSafeEqual(provided, expected)) return "unauthorized";
  return "allow";
}
