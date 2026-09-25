import { NextResponse } from "next/server";
import { isOwner } from "@/lib/operators/access";
import { readActorFromRequest } from "@/lib/operators/current";
import { authMailReady, sendInviteMail } from "@/lib/operators/mail";
import { grantsLookValid } from "@/lib/operators/access";
import { OperatorsUnavailableError, createOperator, issueToken, listOperators } from "@/lib/operators/store";
import type { OperatorGrant } from "@/lib/operators/types";

function normalizeGrants(raw: unknown): OperatorGrant[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const grant = item as Partial<OperatorGrant>;
    if (grant.capability !== "compose" && grant.capability !== "steward" && grant.capability !== "sales") return [];
    const scopeType = grant.capability === "sales" ? "sales" : grant.scopeType === "garden" ? "garden" : "bloom";
    return [{ capability: grant.capability, scopeType, scopeId: grant.scopeId?.trim() || null }];
  });
}

export async function GET(request: Request) {
  const actor = await readActorFromRequest(request);
  if (!isOwner(actor)) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  try {
    const people = await listOperators();
    return NextResponse.json({
      people,
      mailReady: authMailReady(),
      mailHint: authMailReady()
        ? null
        : "Set RESEND_API_KEY and AUTH_FROM_EMAIL so invites and password resets can send.",
    });
  } catch (err) {
    if (err instanceof OperatorsUnavailableError) return NextResponse.json({ error: err.message, setup: true }, { status: 503 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load people." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await readActorFromRequest(request);
  if (!isOwner(actor)) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  let body: { name?: string; email?: string; grants?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = body.name?.trim() || "";
  const email = body.email?.trim().toLowerCase() || "";
  const grants = normalizeGrants(body.grants);
  if (!name || !email.includes("@")) return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  const grantError = grantsLookValid(grants);
  if (grantError) return NextResponse.json({ error: grantError }, { status: 400 });
  if (grants.length === 0) return NextResponse.json({ error: "Add at least one permission." }, { status: 400 });

  try {
    const person = await createOperator({ name, email, grants });
    const token = await issueToken(person.id, "invite");
    await sendInviteMail(person.email, person.name, token);
    return NextResponse.json({ person }, { status: 201 });
  } catch (err) {
    if (err instanceof OperatorsUnavailableError) return NextResponse.json({ error: err.message, setup: true }, { status: 503 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not add this person." }, { status: 400 });
  }
}
