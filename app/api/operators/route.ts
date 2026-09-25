import { NextResponse } from "next/server";
import { grantAssignmentError, isOwner, normalizeGrantInput } from "@/lib/operators/access";
import { readActorFromRequest } from "@/lib/operators/current";
import { authMailHint, authMailReady, sendInviteMail } from "@/lib/operators/mail";
import { OperatorsUnavailableError, createOperator, issueToken, listOperators } from "@/lib/operators/store";

export async function GET(request: Request) {
  const actor = await readActorFromRequest(request);
  if (!isOwner(actor)) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  try {
    const people = await listOperators();
    return NextResponse.json({
      people,
      mailReady: authMailReady(),
      mailHint: authMailHint(),
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
  const grants = normalizeGrantInput(body.grants);
  if (!name || !email.includes("@")) return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  const grantError = grantAssignmentError(grants);
  if (grantError) return NextResponse.json({ error: grantError }, { status: 400 });

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
