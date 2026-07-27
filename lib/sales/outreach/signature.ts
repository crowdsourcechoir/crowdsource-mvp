/**
 * Trailing signature appended after the fixed "Best,\nJoel" sign-off.
 * Included in the draft body itself because loading via mailto:/clipboard into Gmail does not
 * populate the user's Gmail signature settings.
 *
 * Plain text keeps the exact words (no bare URL). HTML clipboard / in-app display make
 * "Crowdsource Choir" a real hyperlink to https://crowdsourcechoir.com.
 */
export const CROWDSOURCE_SITE_URL = "https://crowdsourcechoir.com";

export const EMAIL_SIGNATURE_PLAIN = [
  "--",
  "Joel DeJong",
  "Creator, Crowdsource Choir",
  "'One of the Pacific Northwest's Most Talented Composers'",
  "—American Songwriter",
].join("\n");

const SIGNATURE_MARKER = "One of the Pacific Northwest's Most Talented Composers";

/** True when the body already includes the press-quote signature block. */
export function hasEmailSignature(body: string): boolean {
  return body.includes(SIGNATURE_MARKER);
}

/**
 * Drop the bare https://crowdsourcechoir.com line that used to sit under
 * "Creator, Crowdsource Choir" — the name itself is the link in HTML/UI now.
 */
export function stripSignatureBareUrl(body: string): string {
  return body.replace(
    /(Creator, Crowdsource Choir)\nhttps?:\/\/(?:www\.)?crowdsourcechoir\.com\/?/g,
    "$1"
  );
}

/**
 * Ensures the body ends with the Crowdsource Choir signature after the "Joel" sign-off.
 * Idempotent — also normalizes older drafts that still show the bare site URL.
 */
export function ensureEmailSignature(body: string): string {
  if (!body) return body;
  const trimmed = stripSignatureBareUrl(body.replace(/[ \t]+$/gm, "").replace(/\n+$/, ""));
  if (hasEmailSignature(trimmed)) return trimmed;
  return `${trimmed}\n\n${EMAIL_SIGNATURE_PLAIN}`;
}

/**
 * HTML body for clipboard paste into Gmail — "Crowdsource Choir" in the signature is a
 * real hyperlink; earlier mentions in the pitch stay plain text.
 */
export function emailBodyToHtml(body: string): string {
  const withSig = ensureEmailSignature(body);
  const escaped = withSig
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const needle = "Creator, Crowdsource Choir";
  const idx = escaped.lastIndexOf(needle);
  const linked =
    idx >= 0
      ? `${escaped.slice(0, idx)}Creator, <a href="${CROWDSOURCE_SITE_URL}">Crowdsource Choir</a>${escaped.slice(idx + needle.length)}`
      : escaped;

  return linked.replace(/\n/g, "<br>\n");
}

/** Split points for rendering the signature "Crowdsource Choir" as a React link. */
export function splitBodyForSignatureLink(body: string): { before: string; after: string } | null {
  const withSig = ensureEmailSignature(body);
  const needle = "Creator, Crowdsource Choir";
  const idx = withSig.lastIndexOf(needle);
  if (idx < 0) return null;
  return {
    before: withSig.slice(0, idx + "Creator, ".length),
    after: withSig.slice(idx + needle.length),
  };
}
