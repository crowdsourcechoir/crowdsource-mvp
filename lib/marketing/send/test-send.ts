import { getGmailConnectionStatus } from "../../sales/db/gmail";
import { sendGmailMessage } from "../../sales/gmail/send";
import { marketingDb } from "../db/client";
import { MarketingDbError, raiseDb } from "../db/errors";
import type { MailSender } from "../providers/types";
import { resendConfigured, resendSender } from "../providers/resend";
import { chooseTestTransport } from "./checks";
import { messageForRecipient, testSubject, testUnsubscribeLink } from "./deliver";
import { prepareSendVersion } from "./prepare";

export type TestSendResult =
  | { ok: true; providerMessageId: string; via: "resend" | "gmail" }
  | { ok: false; error: string; status: number };

function failure(err: unknown): TestSendResult {
  if (err instanceof MarketingDbError) {
    const error = err.message.includes("Nothing was mailed") ? err.message : `${err.message} Nothing was mailed.`;
    return { ok: false, error, status: err.status };
  }
  const message = err instanceof Error ? err.message : "Could not send the test.";
  return { ok: false, error: message.includes("Nothing was mailed") ? message : `${message} Nothing was mailed.`, status: 500 };
}

async function gmailSendingOn(override: boolean | undefined): Promise<boolean> {
  if (typeof override === "boolean") return override;
  try {
    const status = await getGmailConnectionStatus();
    return status.connected && status.sendsEnabled;
  } catch {
    return false;
  }
}

export async function sendTestEmail(input: {
  sendId: string;
  to: string;
  sender?: MailSender;
  gmailSendsEnabled?: boolean;
}): Promise<TestSendResult> {
  let prepared;
  try {
    prepared = await prepareSendVersion(input.sendId);
  } catch (err) {
    return failure(err);
  }

  const choice = chooseTestTransport({
    to: input.to,
    fromEmail: prepared.fromEmail,
    resendConfigured: input.sender ? true : resendConfigured(),
    gmailSendsEnabled: await gmailSendingOn(input.gmailSendsEnabled),
  });
  if (!choice.ok) {
    return { ok: false, error: choice.error, status: choice.error.startsWith("Enter a real") ? 400 : 409 };
  }

  const message = messageForRecipient({
    prepared,
    to: choice.to,
    unsubscribe: testUnsubscribeLink(choice.to),
    subject: testSubject(prepared.subject),
    idempotencyKey: `test:${prepared.versionId}:${choice.to}`,
  });

  let providerMessageId: string | null = null;
  if (choice.transport === "gmail") {
    try {
      const sent = await sendGmailMessage({
        to: choice.to,
        subject: message.subject,
        body: message.text,
        html: message.html,
      });
      providerMessageId = sent.messageId;
    } catch (err) {
      return failure(err);
    }
  } else {
    const sender = input.sender ?? resendSender();
    try {
      const outcome = await sender.sendOne(message);
      if (!outcome.id) {
        return { ok: false, error: `${outcome.error || "Resend rejected the test."} Nothing was mailed.`, status: 502 };
      }
      providerMessageId = outcome.id;
    } catch (err) {
      return failure(err);
    }
  }

  const db = marketingDb();
  const { error } = await db.from("email_test_sends").insert({
    campaign_id: prepared.campaignId,
    document_version_id: prepared.versionId,
    to_email: choice.to,
    provider_message_id: providerMessageId,
  });
  raiseDb(error);
  return { ok: true, providerMessageId, via: choice.transport };
}
