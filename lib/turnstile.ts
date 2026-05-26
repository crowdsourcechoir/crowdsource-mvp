const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const TURNSTILE_SITE_KEY =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "" : "";

export function isTurnstileClientConfigured(): boolean {
  return TURNSTILE_SITE_KEY.length > 0;
}

export function isTurnstileServerConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export function isTurnstileReady(): boolean {
  return isTurnstileClientConfigured() && isTurnstileServerConfigured();
}

type TurnstileVerifyResult = {
  success: boolean;
  "error-codes"?: string[];
};

export async function verifyTurnstileToken(args: {
  token: string;
  remoteIp?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: false, error: "Turnstile is not configured." };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", args.token);
    if (args.remoteIp) body.set("remoteip", args.remoteIp);

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      return { ok: false, error: "Captcha verification failed." };
    }

    const result = (await response.json()) as TurnstileVerifyResult;
    if (!result.success) {
      return {
        ok: false,
        error:
          result["error-codes"] && result["error-codes"].length > 0
            ? `Captcha failed (${result["error-codes"].join(", ")})`
            : "Captcha verification failed.",
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Captcha verification request failed." };
  }
}
