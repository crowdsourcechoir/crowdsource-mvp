import { decideAccess, grantAssignmentError, homePath, normalizeGrantInput } from "../lib/operators/access";
import { authMailFrom, authMailHint, isUnverifiedDomainError, unverifiedDomainMessage } from "../lib/operators/mail";
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
  ["anon pitch unlock", decide("/api/sobeca-song-garden/access", "POST", null).kind === "public"],
  ["anon pitch password save", decide("/api/sobeca-song-garden/access", "PATCH", null).kind === "deny"],
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
  const previousOwner = process.env.OPERATOR_OWNER_EMAIL;
  process.env.RESEND_API_KEY = "re_test";
  delete process.env.AUTH_FROM_EMAIL;
  delete process.env.OPERATOR_OWNER_EMAIL;
  assert(authMailHint() === null, "resend key clears the mail warning");
  assert(authMailFrom() === "Crowdsource Choir <sing@crowdsourcechoir.com>", "from defaults to the owner address");
  process.env.AUTH_FROM_EMAIL = "hello@crowdsourcechoir.com";
  assert(authMailFrom() === "Crowdsource Choir <hello@crowdsourcechoir.com>", "from address can be overridden");
  delete process.env.RESEND_API_KEY;
  assert(authMailHint() === "Invites and password resets need the Resend key on the server.", "missing resend key warns");
  assert(isUnverifiedDomainError("The crowdsourcechoir.com domain is not verified. Please, add and verify your domain on https://resend.com/domains"), "detects unverified domain");
  assert(unverifiedDomainMessage().includes("resend.com/domains"), "domain message points at Resend");
  if (previousKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = previousKey;
  if (previousFrom === undefined) delete process.env.AUTH_FROM_EMAIL;
  else process.env.AUTH_FROM_EMAIL = previousFrom;
  if (previousOwner === undefined) delete process.env.OPERATOR_OWNER_EMAIL;
  else process.env.OPERATOR_OWNER_EMAIL = previousOwner;
  const stored = await hashPassword("correct horse");
  assert(await verifyPassword("correct horse", stored), "password matches");
  assert(!(await verifyPassword("nope", stored)), "password rejects");
  console.log(`operator access checks passed (${checks.length})`);
}

void main();
