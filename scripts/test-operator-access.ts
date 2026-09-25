import { decideAccess, grantAssignmentError, homePath, normalizeGrantInput } from "../lib/operators/access";
import { authMailHint } from "../lib/operators/mail";
import { hashPassword, verifyPassword } from "../lib/operators/password";
import type { Actor } from "../lib/operators/types";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

const artist: Actor = {
  id: "a",
  email: "a@example.com",
  name: "Artist",
  role: "member",
  sessionVersion: 1,
  legacy: false,
  sales: false,
  stewardBlooms: [],
  composeBlooms: ["bloom-1"],
  stewardGardens: [],
  composeGardens: ["garden-1"],
};

const sales: Actor = {
  ...artist,
  id: "s",
  sales: true,
  composeBlooms: [],
  composeGardens: [],
};

const owner: Actor = { ...artist, id: "o", role: "owner", sales: true };

function decide(path: string, method: string, actor: Actor | null, query = "") {
  return decideAccess(path, method, new URLSearchParams(query), actor);
}

const checks: Array<[string, boolean]> = [
  ["public journey", decide("/e/csc-oct2", "GET", null).kind === "public"],
  ["public snapshot", decide("/api/gardens/wfea/snapshot", "GET", null).kind === "public"],
  ["public submit", decide("/api/songgarden", "POST", null).kind === "public"],
  ["artist composer", decide("/admin/composer", "GET", artist, "bloom=bloom-1").kind === "allow"],
  ["artist other bloom", decide("/admin/composer", "GET", artist, "bloom=bloom-2").kind === "redirect"],
  ["artist settings", decide("/admin/settings/access", "GET", artist).kind === "redirect"],
  ["artist sales api", decide("/api/sales/queue", "GET", artist).kind === "deny"],
  ["artist clips", decide("/api/songgarden", "GET", artist, "eventId=bloom-1").kind === "allow"],
  ["artist other clips", decide("/api/songgarden", "GET", artist, "eventId=bloom-9").kind === "deny"],
  ["sales queue", decide("/admin/sales", "GET", sales).kind === "allow"],
  ["sales send", decide("/api/sales/gmail/sends", "POST", sales).kind === "deny"],
  ["owner send", decide("/api/sales/gmail/sends", "POST", owner).kind === "allow"],
  ["anon admin", decide("/admin/gardens", "GET", null).kind === "redirect"],
  ["artist home", homePath(artist) === "/admin/composer?bloom=bloom-1"],
  ["sales home", homePath(sales) === "/admin/sales"],
];

async function main() {
  for (const [name, ok] of checks) assert(ok, name);
  const normalized = normalizeGrantInput([
    { capability: "compose", scopeType: "bloom", scopeId: " bloom-1 " },
    { capability: "compose", scopeType: "bloom", scopeId: "bloom-1" },
    { capability: "sales", scopeType: "bloom", scopeId: "nope" },
    { capability: "nope" },
  ]);
  assert(normalized.length === 2, "grant normalize dedupes");
  assert(normalized[0].scopeId === "bloom-1", "grant normalize trims bloom id");
  assert(normalized[1].capability === "sales" && normalized[1].scopeId === null && normalized[1].scopeType === "sales", "sales grant drops scope");
  assert(grantAssignmentError([]) === "Add at least one permission.", "empty grants rejected");
  assert(grantAssignmentError([{ capability: "compose", scopeType: "bloom", scopeId: "" }]) === "Pick a Bloom or Song Garden for each grant.", "missing bloom rejected");
  assert(grantAssignmentError(normalized) === null, "valid grants accepted");
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.AUTH_FROM_EMAIL;
  process.env.RESEND_API_KEY = "re_test";
  delete process.env.AUTH_FROM_EMAIL;
  assert(
    authMailHint() === "Set AUTH_FROM_EMAIL to a verified Resend from-address so invites and password resets can send.",
    "resend key present still needs from-address"
  );
  process.env.AUTH_FROM_EMAIL = "sing@crowdsourcechoir.com";
  assert(authMailHint() === null, "mail ready when key and from are set");
  if (previousKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = previousKey;
  if (previousFrom === undefined) delete process.env.AUTH_FROM_EMAIL;
  else process.env.AUTH_FROM_EMAIL = previousFrom;
  const stored = await hashPassword("correct horse");
  assert(await verifyPassword("correct horse", stored), "password matches");
  assert(!(await verifyPassword("nope", stored)), "password rejects");
  console.log(`operator access checks passed (${checks.length})`);
}

void main();
