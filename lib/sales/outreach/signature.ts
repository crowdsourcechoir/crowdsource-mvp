/**
 * Outreach and campaign mail go out through the Gmail API or Resend, which do not append
 * the account signature. The block is added once at send time. Draft editors still strip it
 * so a mailto launch does not show it twice when the Gmail window adds its own.
 */

const SIGNATURE_MARKER = "One of the Pacific Northwest's Most Talented Composers";

export const EMAIL_SIGNATURE = [
  "--",
  "Joel DeJong",
  "Creator, Crowdsource Choir",
  "'One of the Pacific Northwest's Most Talented Composers'",
  "—American Songwriter",
].join("\n");

/** True when the body includes the press-quote signature block we used to embed. */
export function hasEmailSignature(body: string): boolean {
  return body.includes(SIGNATURE_MARKER);
}

/**
 * Removes a trailing Crowdsource Choir press-quote signature (with or without a bare URL line)
 * after the "Best,\\nJoel" sign-off. Idempotent.
 */
export function stripEmailSignature(body: string): string {
  if (!body) return body;

  let next = body.replace(
    /(Creator, Crowdsource Choir)\nhttps?:\/\/(?:www\.)?crowdsourcechoir\.com\/?/g,
    "$1"
  );

  // "--\nJoel DeJong\nCreator, Crowdsource Choir\n'...'\n—American Songwriter" at end
  next = next.replace(
    /\n*\n--\nJoel DeJong\nCreator, Crowdsource Choir\n'One of the Pacific Northwest's Most Talented Composers'\n—American Songwriter\s*$/,
    ""
  );

  // Older variant that used {{sender_name}} / Joel DeJong on the Best line before the block
  next = next.replace(
    /\n*\n--\n[^\n]+\nCreator, Crowdsource Choir\n'One of the Pacific Northwest's Most Talented Composers'\n—American Songwriter\s*$/,
    ""
  );

  return next.replace(/[ \t]+$/gm, "").replace(/\n+$/, "");
}

/** Append Joel's signature once. A body that already contains the block is left as-is. */
export function ensureEmailSignature(body: string): string {
  const stripped = stripEmailSignature(body ?? "");
  if (hasEmailSignature(stripped)) return stripped.replace(/\s+$/, "");
  const base = stripped.replace(/\s+$/, "");
  if (!base) return EMAIL_SIGNATURE;
  return `${base}\n\n${EMAIL_SIGNATURE}`;
}

function escapeSignatureHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HTML form of the signature, for messages that already have their own HTML body. */
export function emailSignatureHtml(): string {
  const lines = EMAIL_SIGNATURE.split("\n").map((line) => escapeSignatureHtml(line)).join("<br>");
  return `<p style="margin:24px 0 0;font-family:sans-serif;font-size:14px;line-height:1.45;">${lines}</p>`;
}

export function ensureEmailSignatureHtml(html: string): string {
  if (!html) return emailSignatureHtml();
  if (html.includes(SIGNATURE_MARKER)) return html;
  const block = emailSignatureHtml();
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${block}</body>`);
  return `${html}${block}`;
}
