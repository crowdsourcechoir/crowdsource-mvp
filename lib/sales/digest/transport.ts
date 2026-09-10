/**
 * Which mailer delivers the morning sales digest.
 *
 * Digest is Joel mailing himself about leads — always Gmail (connected account → same mailbox).
 * Resend is reserved for OCTO marketing campaigns (`lib/marketing/email/send.ts`), not digest.
 */

export type DigestTransport = "gmail" | "none";

function sameMailbox(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = a?.trim().toLowerCase();
  const right = b?.trim().toLowerCase();
  return Boolean(left && right && left === right);
}

export function chooseDigestTransport(input: {
  configuredTo?: string | null;
  gmailConnected: boolean;
  gmailEmail?: string | null;
}): { transport: DigestTransport; to: string | null; reason?: string } {
  const to = input.configuredTo?.trim() || input.gmailEmail?.trim() || null;
  if (!to) {
    return {
      transport: "none",
      to: null,
      reason: "No digest recipient. Connect Gmail on /admin/settings/gmail or set SALES_DIGEST_TO_EMAIL.",
    };
  }

  if (input.gmailConnected && sameMailbox(to, input.gmailEmail)) {
    return { transport: "gmail", to };
  }

  if (!input.gmailConnected) {
    return {
      transport: "none",
      to,
      reason: `Connect Gmail to deliver the digest to ${to}. Resend is for marketing campaigns only.`,
    };
  }

  return {
    transport: "none",
    to,
    reason: `Digest recipient (${to}) must match the connected Gmail account (${input.gmailEmail}). Resend is for marketing campaigns only.`,
  };
}
