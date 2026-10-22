import { NextResponse } from "next/server";
import { sendResetMail } from "@/lib/operators/mail";
import { OperatorsUnavailableError, findActiveByEmail, issueToken } from "@/lib/operators/store";

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase() || "";
  if (!email.includes("@")) return NextResponse.json({ error: "Enter the email on your account." }, { status: 400 });

  try {
    const person = await findActiveByEmail(email);
    if (person) {
      const token = await issueToken(person.id, "reset");
      await sendResetMail(person.email, person.name, token);
    }
  } catch (err) {
    if (err instanceof OperatorsUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Could not send reset email.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "If that email has an account, a reset link is on its way.",
  });
}
