import { supabaseAdmin } from "@/lib/supabase-server";
import { hashPassword, hashToken, newToken, verifyPassword } from "./password";
import { ownerEmail } from "./session";
import type { Actor, OperatorGrant, OperatorRecord, OperatorRole, OperatorStatus } from "./types";

type OperatorRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  role: OperatorRole;
  status: OperatorStatus;
  session_version: number;
};

type GrantRow = {
  id: string;
  operator_id: string;
  capability: OperatorGrant["capability"];
  scope_type: OperatorGrant["scopeType"];
  scope_id: string | null;
};

export class OperatorsUnavailableError extends Error {
  constructor(message = "People are not set up yet. Run supabase/operators-and-grants.sql in the Supabase SQL Editor.") {
    super(message);
    this.name = "OperatorsUnavailableError";
  }
}

function missingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /operators|operator_grants|operator_tokens/i.test(error.message || "");
}

function assertDb() {
  if (!supabaseAdmin) throw new OperatorsUnavailableError("Database not configured.");
  return supabaseAdmin;
}

function mapGrant(row: GrantRow): OperatorGrant {
  return { id: row.id, capability: row.capability, scopeType: row.scope_type, scopeId: row.scope_id };
}

async function grantsFor(operatorIds: string[]): Promise<Map<string, OperatorGrant[]>> {
  const db = assertDb();
  const grouped = new Map<string, OperatorGrant[]>();
  if (operatorIds.length === 0) return grouped;
  const { data, error } = await db.from("operator_grants").select("id, operator_id, capability, scope_type, scope_id").in("operator_id", operatorIds);
  if (error) {
    if (missingTable(error)) throw new OperatorsUnavailableError();
    throw new Error(error.message);
  }
  for (const row of (data ?? []) as GrantRow[]) {
    const list = grouped.get(row.operator_id) ?? [];
    list.push(mapGrant(row));
    grouped.set(row.operator_id, list);
  }
  return grouped;
}

function toRecord(row: OperatorRow, grants: OperatorGrant[]): OperatorRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    sessionVersion: row.session_version,
    hasPassword: Boolean(row.password_hash),
    grants,
  };
}

export async function listOperators(): Promise<OperatorRecord[]> {
  const db = assertDb();
  const { data, error } = await db.from("operators").select("id, email, name, password_hash, role, status, session_version").order("created_at", { ascending: true });
  if (error) {
    if (missingTable(error)) throw new OperatorsUnavailableError();
    throw new Error(error.message);
  }
  const rows = (data ?? []) as OperatorRow[];
  const grants = await grantsFor(rows.map((row) => row.id));
  return rows.map((row) => toRecord(row, grants.get(row.id) ?? []));
}

export async function getOperator(id: string): Promise<OperatorRecord | null> {
  const db = assertDb();
  const { data, error } = await db.from("operators").select("id, email, name, password_hash, role, status, session_version").eq("id", id).maybeSingle();
  if (error) {
    if (missingTable(error)) throw new OperatorsUnavailableError();
    throw new Error(error.message);
  }
  if (!data) return null;
  const grants = await grantsFor([id]);
  return toRecord(data as OperatorRow, grants.get(id) ?? []);
}

async function findRowByEmail(email: string): Promise<OperatorRow | null> {
  const db = assertDb();
  const { data, error } = await db.from("operators").select("id, email, name, password_hash, role, status, session_version").ilike("email", email).maybeSingle();
  if (error) {
    if (missingTable(error)) throw new OperatorsUnavailableError();
    throw new Error(error.message);
  }
  return (data as OperatorRow | null) ?? null;
}

async function chapterLinks(): Promise<Array<{ gardenId: string; eventId: string }>> {
  const db = assertDb();
  const { data, error } = await db.from("garden_chapters").select("garden_id, event_id");
  if (error) {
    if (missingTable(error) || /garden_chapters/i.test(error.message)) return [];
    return [];
  }
  return (data ?? []).map((row) => ({
    gardenId: String((row as { garden_id: string }).garden_id),
    eventId: String((row as { event_id: string }).event_id),
  }));
}

export async function actorFromOperator(person: OperatorRecord): Promise<Omit<Actor, "legacy">> {
  const links = person.role === "owner" ? [] : await chapterLinks();
  const stewardGardens = person.grants.filter((g) => g.capability === "steward" && g.scopeType === "garden" && g.scopeId).map((g) => g.scopeId as string);
  const stewardBlooms = person.grants.filter((g) => g.capability === "steward" && g.scopeType === "bloom" && g.scopeId).map((g) => g.scopeId as string);
  const composeBlooms = new Set<string>(stewardBlooms);
  for (const grant of person.grants) {
    if (grant.capability === "compose" && grant.scopeType === "bloom" && grant.scopeId) composeBlooms.add(grant.scopeId);
  }
  for (const link of links) {
    if (stewardGardens.includes(link.gardenId)) composeBlooms.add(link.eventId);
  }
  const composeGardens = new Set<string>(stewardGardens);
  for (const link of links) {
    if (composeBlooms.has(link.eventId)) composeGardens.add(link.gardenId);
  }
  return {
    id: person.id,
    email: person.email,
    name: person.name,
    role: person.role,
    sessionVersion: person.sessionVersion,
    sales: person.role === "owner" || person.grants.some((g) => g.capability === "sales"),
    stewardBlooms,
    composeBlooms: Array.from(composeBlooms),
    stewardGardens,
    composeGardens: Array.from(composeGardens),
  };
}

export async function sessionVersionOf(id: string): Promise<{ status: OperatorStatus; sessionVersion: number } | null> {
  const db = assertDb();
  const { data, error } = await db.from("operators").select("status, session_version").eq("id", id).maybeSingle();
  if (error) {
    if (missingTable(error)) throw new OperatorsUnavailableError();
    throw new Error(error.message);
  }
  if (!data) return null;
  const row = data as { status: OperatorStatus; session_version: number };
  return { status: row.status, sessionVersion: row.session_version };
}

async function replaceGrants(operatorId: string, grants: OperatorGrant[]) {
  const db = assertDb();
  const { error: deleteError } = await db.from("operator_grants").delete().eq("operator_id", operatorId);
  if (deleteError) throw new Error(deleteError.message);
  if (grants.length === 0) return;
  const rows = grants.map((grant) => ({
    operator_id: operatorId,
    capability: grant.capability,
    scope_type: grant.scopeType,
    scope_id: grant.capability === "sales" ? null : grant.scopeId,
  }));
  const { error } = await db.from("operator_grants").insert(rows);
  if (error) throw new Error(error.message);
}

export async function findOperatorByEmail(email: string): Promise<OperatorRecord | null> {
  const row = await findRowByEmail(email.trim().toLowerCase());
  if (!row) return null;
  const grants = await grantsFor([row.id]);
  return toRecord(row, grants.get(row.id) ?? []);
}

export async function deleteOperator(id: string): Promise<void> {
  const current = await getOperator(id);
  if (!current) return;
  if (current.role === "owner") throw new Error("The owner account stays.");
  const db = assertDb();
  const { error } = await db.from("operators").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createOperator(input: { name: string; email: string; grants: OperatorGrant[] }): Promise<OperatorRecord> {
  const db = assertDb();
  const email = input.email.trim().toLowerCase();
  const existing = await findRowByEmail(email);
  if (existing) throw new Error("Someone with that email already has access.");
  const { data, error } = await db
    .from("operators")
    .insert({ email, name: input.name.trim(), role: "member", status: "invited", password_hash: null })
    .select("id, email, name, password_hash, role, status, session_version")
    .single();
  if (error) {
    if (missingTable(error)) throw new OperatorsUnavailableError();
    throw new Error(error.message);
  }
  const row = data as OperatorRow;
  await replaceGrants(row.id, input.grants);
  return (await getOperator(row.id)) as OperatorRecord;
}

export async function updateOperator(
  id: string,
  patch: { name?: string; status?: OperatorStatus; grants?: OperatorGrant[] }
): Promise<OperatorRecord> {
  const current = await getOperator(id);
  if (!current) throw new Error("Person not found.");
  if (current.role === "owner" && patch.status === "disabled") {
    throw new Error("The owner account stays active.");
  }
  if (current.role === "owner" && patch.grants) {
    throw new Error("The owner already has full access.");
  }
  const db = assertDb();
  const next: Record<string, unknown> = { updated_at: new Date().toISOString(), session_version: current.sessionVersion + 1 };
  if (patch.name?.trim()) next.name = patch.name.trim();
  if (patch.status && current.role !== "owner") next.status = patch.status;
  const { error } = await db.from("operators").update(next).eq("id", id);
  if (error) throw new Error(error.message);
  if (patch.grants && current.role !== "owner") await replaceGrants(id, patch.grants);
  return (await getOperator(id)) as OperatorRecord;
}

export async function issueToken(operatorId: string, purpose: "invite" | "reset"): Promise<string> {
  const db = assertDb();
  const token = newToken();
  const tokenHash = await hashToken(token);
  const hours = purpose === "invite" ? 24 * 7 : 1;
  const expires = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  await db.from("operator_tokens").update({ used_at: new Date().toISOString() }).eq("operator_id", operatorId).eq("purpose", purpose).is("used_at", null);
  const { error } = await db.from("operator_tokens").insert({
    operator_id: operatorId,
    token_hash: tokenHash,
    purpose,
    expires_at: expires,
  });
  if (error) {
    if (missingTable(error)) throw new OperatorsUnavailableError();
    throw new Error(error.message);
  }
  return token;
}

export async function consumeToken(token: string, purpose: "invite" | "reset", password: string): Promise<OperatorRecord> {
  const db = assertDb();
  const tokenHash = await hashToken(token);
  const { data, error } = await db.from("operator_tokens").select("id, operator_id, expires_at, used_at, purpose").eq("token_hash", tokenHash).maybeSingle();
  if (error) {
    if (missingTable(error)) throw new OperatorsUnavailableError();
    throw new Error(error.message);
  }
  const row = data as { id: string; operator_id: string; expires_at: string; used_at: string | null; purpose: string } | null;
  if (!row || row.purpose !== purpose || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    throw new Error("This link is no longer valid. Ask for a new one.");
  }
  const passwordHash = await hashPassword(password);
  const person = await getOperator(row.operator_id);
  if (!person || person.status === "disabled") throw new Error("This account is disabled.");
  const { error: updateError } = await db
    .from("operators")
    .update({
      password_hash: passwordHash,
      status: "active",
      session_version: person.sessionVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", person.id);
  if (updateError) throw new Error(updateError.message);
  await db.from("operator_tokens").update({ used_at: new Date().toISOString() }).eq("id", row.id);
  return (await getOperator(person.id)) as OperatorRecord;
}

export async function authenticate(email: string, password: string): Promise<OperatorRecord | null> {
  const row = await findRowByEmail(email.trim().toLowerCase());
  if (!row || row.status === "disabled" || row.status === "invited") return null;
  const match = await verifyPassword(password, row.password_hash);
  if (!match) return null;
  const grants = await grantsFor([row.id]);
  return toRecord(row, grants.get(row.id) ?? []);
}

export async function ensureOwner(password: string): Promise<OperatorRecord | null> {
  const db = assertDb();
  const email = ownerEmail().toLowerCase();
  const existing = await findRowByEmail(email);
  if (existing) {
    if (existing.role !== "owner") throw new Error("The owner email is already used by another person.");
    if (!existing.password_hash) {
      const passwordHash = await hashPassword(password);
      await db.from("operators").update({ password_hash: passwordHash, status: "active", updated_at: new Date().toISOString() }).eq("id", existing.id);
      return getOperator(existing.id);
    }
    const match = await verifyPassword(password, existing.password_hash);
    if (!match) return null;
    return getOperator(existing.id);
  }
  const passwordHash = await hashPassword(password);
  const { data, error } = await db
    .from("operators")
    .insert({
      email,
      name: process.env.SALES_SENDER_NAME?.trim() || "Owner",
      role: "owner",
      status: "active",
      password_hash: passwordHash,
    })
    .select("id")
    .single();
  if (error) {
    if (missingTable(error)) throw new OperatorsUnavailableError();
    throw new Error(error.message);
  }
  return (await getOperator((data as { id: string }).id)) as OperatorRecord;
}

export async function findActiveByEmail(email: string): Promise<OperatorRecord | null> {
  const row = await findRowByEmail(email.trim().toLowerCase());
  if (!row || row.status !== "active") return null;
  const grants = await grantsFor([row.id]);
  return toRecord(row, grants.get(row.id) ?? []);
}
