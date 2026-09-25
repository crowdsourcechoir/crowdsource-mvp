import { decideAccess, homePath } from "../lib/operators/access";
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
  const stored = await hashPassword("correct horse");
  assert(await verifyPassword("correct horse", stored), "password matches");
  assert(!(await verifyPassword("nope", stored)), "password rejects");
  console.log(`operator access checks passed (${checks.length})`);
}

void main();
