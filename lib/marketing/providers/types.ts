export type OutboundEmail = {
  idempotencyKey: string;
  to: string;
  from: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
};

export type SendOutcome = { id: string | null; error: string | null };

export type MailSender = {
  sendOne(message: OutboundEmail): Promise<SendOutcome>;
  sendBatch(messages: OutboundEmail[]): Promise<SendOutcome[]>;
};
