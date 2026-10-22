import { normalizeMarketingEmail } from "../ids";

export function marketingKillSwitch(): string | null {
  if (process.env.MARKETING_SENDS_ENABLED === "false") {
    return "Marketing sends are off (MARKETING_SENDS_ENABLED=false). Nothing was mailed.";
  }
  return null;
}

export function checkTestSend(input: {
  to: string;
  fromEmail: string;
  resendConfigured: boolean;
}): { ok: true; to: string } | { ok: false; error: string } {
  const killed = marketingKillSwitch();
  if (killed) return { ok: false, error: killed };
  if (!input.resendConfigured) {
    return { ok: false, error: "RESEND_API_KEY is missing. Nothing was mailed." };
  }
  const to = normalizeMarketingEmail(input.to);
  if (!to) return { ok: false, error: "Enter a real address in Test send to." };
  if (!input.fromEmail.trim()) {
    return { ok: false, error: "Set a from address in Settings → Marketing. Nothing was mailed." };
  }
  return { ok: true, to };
}

/** Resend when marketing delivery is ready. Otherwise the connected Google account, when that sending switch is on. */
export function chooseTestTransport(input: {
  to: string;
  fromEmail: string;
  resendConfigured: boolean;
  gmailSendsEnabled: boolean;
}): { ok: true; to: string; transport: "resend" | "gmail" } | { ok: false; error: string } {
  const to = normalizeMarketingEmail(input.to);
  if (!to) return { ok: false, error: "Enter a real address in Test send to." };
  const killed = marketingKillSwitch();
  if (!killed && input.resendConfigured && input.fromEmail.trim()) {
    return { ok: true, to, transport: "resend" };
  }
  if (input.gmailSendsEnabled) return { ok: true, to, transport: "gmail" };
  if (killed) return { ok: false, error: killed };
  if (!input.resendConfigured) {
    return {
      ok: false,
      error: "RESEND_API_KEY is missing, and sending is off in Settings → Google connections. Nothing was mailed.",
    };
  }
  return {
    ok: false,
    error: "Set a from address in Settings → Marketing, or turn sending on in Settings → Google connections. Nothing was mailed.",
  };
}

export function checkListSend(input: {
  confirmPhrase: string;
  sendsEnabled: boolean;
  fromEmail: string;
  physicalAddress: string;
  companyName: string;
  segmentId: string | null;
  resendConfigured: boolean;
  unsubscribeSecret: string;
}): { ok: true } | { ok: false; error: string } {
  const killed = marketingKillSwitch();
  if (killed) return { ok: false, error: killed };
  if (input.confirmPhrase.trim().toUpperCase() !== "SEND") {
    return { ok: false, error: "Type SEND to mail the list. Nothing was mailed." };
  }
  if (!input.sendsEnabled) {
    return { ok: false, error: "Sends are paused in Settings → Marketing. Nothing was mailed." };
  }
  if (!input.resendConfigured) {
    return { ok: false, error: "RESEND_API_KEY is missing. Nothing was mailed." };
  }
  if (!input.unsubscribeSecret.trim()) {
    return { ok: false, error: "Set MARKETING_UNSUBSCRIBE_SECRET before mailing the list. Nothing was mailed." };
  }
  if (!input.fromEmail.trim()) {
    return { ok: false, error: "Set a from address in Settings → Marketing. Nothing was mailed." };
  }
  if (!input.physicalAddress.trim() || !input.companyName.trim()) {
    return { ok: false, error: "Add a company name and physical address in Settings → Marketing. Nothing was mailed." };
  }
  if (!input.segmentId) {
    return { ok: false, error: "Choose a segment before mailing the list. Nothing was mailed." };
  }
  return { ok: true };
}

export function auditSendableHtml(html: string): string | null {
  if (/src=["']http:\/\//i.test(html)) {
    return "An image uses http://. Use an https image. Nothing was mailed.";
  }
  return null;
}
