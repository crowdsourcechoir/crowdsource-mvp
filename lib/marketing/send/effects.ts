import { marketingDb } from "../db/client";
import { raiseDb } from "../db/errors";

type SuppressionReason = "unsubscribe" | "hard_bounce" | "complaint" | "manual";
type SuppressionSource = "octo" | "resend" | "mailchimp";

export async function ensureSuppression(input: {
  personId: string;
  normalizedEmail: string;
  scope: "marketing" | "all_email";
  reason: SuppressionReason;
  source: SuppressionSource;
}): Promise<void> {
  const db = marketingDb();
  const { data, error } = await db
    .from("suppressions")
    .select("id")
    .eq("normalized_email", input.normalizedEmail)
    .eq("scope", input.scope)
    .eq("reason", input.reason)
    .eq("active", true)
    .maybeSingle();
  raiseDb(error);
  if (data) return;
  const { error: insertError } = await db.from("suppressions").insert({
    person_id: input.personId,
    normalized_email: input.normalizedEmail,
    scope: input.scope,
    reason: input.reason,
    source: input.source,
    active: true,
  });
  if (insertError && insertError.code !== "23505") raiseDb(insertError);
}

async function loadPerson(personId: string): Promise<{ id: string; normalized_email: string } | null> {
  const db = marketingDb();
  const { data, error } = await db.from("people").select("id, normalized_email").eq("id", personId).maybeSingle();
  raiseDb(error);
  return (data as { id: string; normalized_email: string } | null) ?? null;
}

async function markUnsubscribed(input: {
  personId: string;
  subscriptionId: string | null;
  source: "unsubscribe_link" | "complaint";
}): Promise<void> {
  const db = marketingDb();
  const now = new Date().toISOString();
  if (input.subscriptionId) {
    const { error } = await db
      .from("communication_subscriptions")
      .update({ status: "unsubscribed", unsubscribed_at: now, updated_at: now })
      .eq("id", input.subscriptionId)
      .eq("person_id", input.personId);
    raiseDb(error);
  }
  const { error: eventError } = await db.from("subscription_events").insert({
    person_id: input.personId,
    subscription_id: input.subscriptionId,
    event_type: "unsubscribed",
    source: input.source,
    metadata: {},
  });
  raiseDb(eventError);
}

export async function unsubscribePerson(personId: string, subscriptionId: string): Promise<boolean> {
  const person = await loadPerson(personId);
  if (!person) return false;
  await markUnsubscribed({ personId, subscriptionId, source: "unsubscribe_link" });
  await ensureSuppression({
    personId,
    normalizedEmail: person.normalized_email,
    scope: "marketing",
    reason: "unsubscribe",
    source: "octo",
  });
  return true;
}

export async function suppressComplaint(personId: string): Promise<void> {
  const person = await loadPerson(personId);
  if (!person) return;
  const db = marketingDb();
  const { data: subscription, error } = await db
    .from("communication_subscriptions")
    .select("id")
    .eq("person_id", personId)
    .eq("channel", "email")
    .eq("topic", "marketing")
    .maybeSingle();
  raiseDb(error);
  const subscriptionId = (subscription as { id: string } | null)?.id ?? null;
  if (subscriptionId) await markUnsubscribed({ personId, subscriptionId, source: "complaint" });
  await ensureSuppression({
    personId,
    normalizedEmail: person.normalized_email,
    scope: "all_email",
    reason: "complaint",
    source: "resend",
  });
}

export async function suppressHardBounce(personId: string): Promise<void> {
  const person = await loadPerson(personId);
  if (!person) return;
  await ensureSuppression({
    personId,
    normalizedEmail: person.normalized_email,
    scope: "all_email",
    reason: "hard_bounce",
    source: "resend",
  });
}
