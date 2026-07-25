/**
 * Canonical public app origin for metadata, share URLs, and email links.
 * Prefer NEXT_PUBLIC_APP_URL when set. In production, never fall back to VERCEL_URL —
 * that is the raw *.vercel.app deployment host and must not appear in customer/operator emails.
 */
export function siteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (process.env.VERCEL_ENV === "production") {
    return "https://app.crowdsourcechoir.com";
  }

  // Preview / local only — deployment-specific host is fine for draft previews.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://app.crowdsourcechoir.com";
}
