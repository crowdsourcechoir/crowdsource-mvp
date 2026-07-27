/**
 * Trailing signature appended after the fixed "Best,\nJoel" sign-off.
 * Included in the draft body itself because loading via mailto:/clipboard into Gmail does not
 * populate the user's Gmail signature settings.
 *
 * Crowdsource Choir links to https://crowdsourcechoir.com — plain text puts the URL on the next
 * line (Gmail auto-links it); HTML clipboard uses a real anchor on the name.
 */
export const CROWDSOURCE_SITE_URL = "https://crowdsourcechoir.com";

export const EMAIL_SIGNATURE_PLAIN = [
  "--",
  "Joel DeJong",
  "Creator, Crowdsource Choir",
  CROWDSOURCE_SITE_URL,
  "'One of the Pacific Northwest's Most Talented Composers'",
  "—American Songwriter",
].join("\n");

const SIGNATURE_MARKER = "One of the Pacific Northwest's Most Talented Composers";

/** True when the body already includes the press-quote signature block. */
export function hasEmailSignature(body: string): boolean {
  return body.includes(SIGNATURE_MARKER);
}

/**
 * Ensures the body ends with the Crowdsource Choir signature after the "Joel" sign-off.
 * Idempotent — safe to run on templates, new drafts, and already-signed bodies.
 */
export function ensureEmailSignature(body: string): string {
  if (!body) return body;
  const trimmed = body.replace(/[ \t]+$/gm, "").replace(/\n+$/, "");
  if (hasEmailSignature(trimmed)) return trimmed;
  return `${trimmed}\n\n${EMAIL_SIGNATURE_PLAIN}`;
}

/** HTML clipboard variant — Crowdsource Choir is a real hyperlink. */
export function emailBodyToHtml(body: string): string {
  const withSig = ensureEmailSignature(body);
  const escaped = withSig
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Turn "Creator, Crowdsource Choir\nhttps://crowdsourcechoir.com" into a linked name.
  const linked = escaped.replace(
    /Creator, Crowdsource Choir(?:\nhttps?:\/\/crowdsourcechoir\.com\/?)?/g,
    `Creator, <a href="${CROWDSOURCE_SITE_URL}">Crowdsource Choir</a>`
  );
  return linked.replace(/\n/g, "<br>\n");
}
