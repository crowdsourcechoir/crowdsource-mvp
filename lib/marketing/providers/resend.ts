import { Resend } from "resend";
import type { MailSender, OutboundEmail, SendOutcome } from "./types";

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

function payload(message: OutboundEmail) {
  return {
    from: message.from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    headers: message.headers,
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
  };
}

function outcome(id: string | null | undefined, error: { message?: string } | null | undefined): SendOutcome {
  if (error) return { id: null, error: error.message || "Resend rejected the message" };
  if (!id) return { id: null, error: "Resend did not return a message id" };
  return { id, error: null };
}

export function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function resendSender(): MailSender {
  return {
    async sendOne(message) {
      const resend = client();
      if (!resend) return { id: null, error: "RESEND_API_KEY is missing" };
      const result = await resend.emails.send(payload(message), { idempotencyKey: message.idempotencyKey });
      return outcome(result.data?.id, result.error);
    },
    async sendBatch(messages) {
      const resend = client();
      if (!resend) return messages.map(() => ({ id: null, error: "RESEND_API_KEY is missing" }));
      if (messages.length === 0) return [];
      const result = await resend.batch.send(
        messages.map(payload),
        { idempotencyKey: messages[0]?.idempotencyKey, batchValidation: "permissive" }
      );
      if (result.error) {
        return messages.map(() => ({ id: null, error: result.error?.message || "Resend rejected the batch" }));
      }
      const body = result.data as { data?: { id: string }[]; errors?: { index: number; message: string }[] } | null;
      const ids = body?.data ?? [];
      const failures = new Map((body?.errors ?? []).map((item) => [item.index, item.message]));
      return messages.map((_message, index) => {
        const failed = failures.get(index);
        if (failed) return { id: null, error: failed };
        return outcome(ids[index]?.id, null);
      });
    },
  };
}
