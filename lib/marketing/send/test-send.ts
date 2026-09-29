import { marketingDb } from "../db/client";
import { MarketingDbError, raiseDb } from "../db/errors";
import type { MailSender } from "../providers/types";
import { resendConfigured, resendSender } from "../providers/resend";
import { checkTestSend } from "./checks";
import { messageForRecipient, testSubject, testUnsubscribeLink } from "./deliver";
import { prepareSendVersion } from "./prepare";

export type TestSendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string; status: number };

function failure(err: unknown): TestSendResult {
  if (err instanceof MarketingDbError) {
    const error = err.message.includes("Nothing was mailed") ? err.message : `${err.message} Nothing was mailed.`;
    return { ok: false, error, status: err.status };
  }
  const message = err instanceof Error ? err.message : "Could not send the test.";
  return { ok: false, error: message.includes("Nothing was mailed") ? message : `${message} Nothing was mailed.`, status: 500 };
}

export async function sendTestEmail(input: { sendId: string; to: string; sender?: MailSender }): Promise<TestSendResult> {
  const gate = checkTestSend({
    to: input.to,
    fromEmail: "pending",
    resendConfigured: input.sender ? true : resendConfigured(),
  });
  if (!gate.ok && gate.error.startsWith("Enter a real")) return { ok: false, error: gate.error, status: 400 };
  if (!gate.ok && gate.error.includes("RESEND_API_KEY")) return { ok: false, error: gate.error, status: 409 };
  if (!gate.ok && gate.error.includes("MARKETING_SENDS_ENABLED")) return { ok: false, error: gate.error, status: 409 };

  let prepared;
  try {
    prepared = await prepareSendVersion(input.sendId);
  } catch (err) {
    return failure(err);
  }

  const ready = checkTestSend({
    to: input.to,
    fromEmail: prepared.fromEmail,
    resendConfigured: input.sender ? true : resendConfigured(),
  });
  if (!ready.ok) return { ok: false, error: ready.error, status: 409 };

  const message = messageForRecipient({
    prepared,
    to: ready.to,
    unsubscribe: testUnsubscribeLink(ready.to),
    subject: testSubject(prepared.subject),
    idempotencyKey: `test:${prepared.versionId}:${ready.to}`,
  });
  const sender = input.sender ?? resendSender();
  let outcome;
  try {
    outcome = await sender.sendOne(message);
  } catch (err) {
    return failure(err);
  }
  if (!outcome.id) {
    return { ok: false, error: `${outcome.error || "Resend rejected the test."} Nothing was mailed.`, status: 502 };
  }

  const db = marketingDb();
  const { error } = await db.from("email_test_sends").insert({
    campaign_id: prepared.campaignId,
    document_version_id: prepared.versionId,
    to_email: ready.to,
    provider_message_id: outcome.id,
  });
  raiseDb(error);
  return { ok: true, providerMessageId: outcome.id };
}
