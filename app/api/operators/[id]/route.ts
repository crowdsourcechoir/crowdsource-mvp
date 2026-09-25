import { NextResponse } from "next/server";
import { grantsLookValid, isOwner } from "@/lib/operators/access";
import { readActorFromRequest } from "@/lib/operators/current";
import { sendInviteMail } from "@/lib/operators/mail";
import { OperatorsUnavailableError, getOperator, issueToken, updateOperator } from "@/lib/operators/store";
import type { OperatorGrant, OperatorStatus } from "@/lib/operators/types";

type Ctx = { params: { id: string } };

function normalizeGrants(raw: unknown): OperatorGrant[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const grant = item as Partial<OperatorGrant>;
    if (grant.capability !== "compose" && grant.capability !== "steward" && grant.capability !== "sales") return [];
    const scopeType = grant.capability === "sales" ? "sales" : grant.scopeType === "garden" ? "garden" : "bloom";
    return [{ capability: grant.capability, scopeType, scopeId: grant.scopeId?.trim() || null }];
  });
}

export async function PATCH(request: Request, context: Ctx) {
  const actor = await readActorFromRequest(request);
  if (!isOwner(actor)) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  let body: { name?: string; status?: OperatorStatus; grants?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const grants = normalizeGrants(body.grants);
  if (grants) {
    const grantError = grantsLookValid(grants);
    if (grantError) return NextResponse.json({ error: grantError }, { status: 400 });
  }
  if (body.status && body.status !== "active" && body.status !== "disabled" && body.status !== "invited") {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  }
  try {
    const person = await updateOperator(context.params.id, { name: body.name, status: body.status, grants });
    return NextResponse.json({ person });
  } catch (err) {
    if (err instanceof OperatorsUnavailableError) return NextResponse.json({ error: err.message }, { status: 503 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update." }, { status: 400 });
  }
}

export async function POST(request: Request, context: Ctx) {
  const actor = await readActorFromRequest(request);
  if (!isOwner(actor)) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  try {
    const person = await getOperator(context.params.id);
    if (!person) return NextResponse.json({ error: "Person not found." }, { status: 404 });
    if (person.status === "disabled") return NextResponse.json({ error: "Enable this person before sending another invite." }, { status: 400 });
    const token = await issueToken(person.id, person.status === "active" ? "reset" : "invite");
    if (person.status === "active") {
      const { sendResetMail } = await import("@/lib/operators/mail");
      await sendResetMail(person.email, person.name, token);
    } else {
      await sendInviteMail(person.email, person.name, token);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OperatorsUnavailableError) return NextResponse.json({ error: err.message }, { status: 503 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not send email." }, { status: 400 });
  }
}
