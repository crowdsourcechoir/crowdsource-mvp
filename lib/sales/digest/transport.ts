/**
 * Which mailer actually delivers the morning digest.
 *
 * Resend's shared sandbox sender (`onboarding@resend.dev`) may only deliver to the Resend
 * account owner, so every cron tick to sing@crowdsourcechoir.com failed with "You can only
 * send testing emails to your own email address". The digest is mail Joel sends himself, so
 * the connected Gmail account can carry it without a verified Resend domain.
 */

export type DigestTransport = "resend" | "gmail" | "none";

const RESEND_SANDBOX_DOMAIN = "resend.dev";

/** `Crowdsource Sales <onboarding@resend.dev>` → `onboarding@resend.dev`. */
export function fromAddressEmail(from: string | null | undefined): string | null {
  const match = from?.match(/[^\s<>@]+@[^\s<>@]+/);
  return match ? match[0].toLowerCase() : null;
}

export function isResendSandboxSender(from: string | null | undefined): boolean {
  const email = fromAddressEmail(from);
  if (!email) return true;
  const domain = email.split("@")[1] ?? "";
  return domain === RESEND_SANDBOX_DOMAIN || domain.endsWith(`.${RESEND_SANDBOX_DOMAIN}`);
}

function sameMailbox(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = a?.trim().toLowerCase();
  const right = b?.trim().toLowerCase();
  return Boolean(left && right && left === right);
}

export function chooseDigestTransport(input: {
  resendApiKey?: string | null;
  resendFrom?: string | null;
  configuredTo?: string | null;
  gmailConnected: boolean;
  gmailEmail?: string | null;
}): { transport: DigestTransport; to: string | null; reason?: string } {
  const to = input.configuredTo?.trim() || input.gmailEmail?.trim() || null;
  if (!to) {
    return {
      transport: "none",
      to: null,
      reason: "No digest recipient. Connect Gmail on /admin/sales or set SALES_DIGEST_TO_EMAIL.",
    };
  }

  const resendReady = Boolean(input.resendApiKey?.trim()) && !isResendSandboxSender(input.resendFrom);
  if (resendReady) return { transport: "resend", to };

  if (input.gmailConnected && sameMailbox(to, input.gmailEmail)) {
    return { transport: "gmail", to };
  }

  return {
    transport: "none",
    to,
    reason: input.resendApiKey?.trim()
      ? `Resend is on its sandbox sender, which can only email the Resend account owner. Verify a domain and set SALES_DIGEST_FROM_EMAIL, or point SALES_DIGEST_TO_EMAIL at the connected Gmail account (${input.gmailEmail ?? "not connected"}).`
      : `No mailer for ${to}. Connect Gmail on /admin/sales, or set RESEND_API_KEY with a verified SALES_DIGEST_FROM_EMAIL.`,
  };
}
