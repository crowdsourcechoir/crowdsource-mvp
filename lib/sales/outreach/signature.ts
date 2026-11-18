/**
 * Outreach and campaign mail go out through the Gmail API or Resend, which do not append
 * the account signature. The block is added once at send / draft-creation time, with
 * "Crowdsource Choir" hyperlinked to https://www.crowdsourcechoir.com in HTML email.
 */

const SIGNATURE_MARKER = "One of the Pacific Northwest's Most Talented Composers";
const SIGNATURE_HTML_RE = /One of the Pacific Northwest(?:'|&#39;|&apos;|\u2019)s Most Talented Composers/i;

export const WEBSITE_DISPLAY_URL = "www.crowdsourcechoir.com";
export const WEBSITE_HREF = "https://www.crowdsourcechoir.com";

export const EMAIL_SIGNATURE = [
  "--",
  "Joel DeJong",
  "Creator, Crowdsource Choir",
  "'One of the Pacific Northwest's Most Talented Composers'",
  "—American Songwriter",
].join("\n");

/** True when the body includes the press-quote signature block we used to embed. */
export function hasEmailSignature(body: string): boolean {
  return body.includes(SIGNATURE_MARKER) || SIGNATURE_HTML_RE.test(body);
}

/**
 * Removes a trailing Crowdsource Choir press-quote signature (with or without a bare URL line
 * or markdown link on Crowdsource Choir) after the "Best,\\nJoel" sign-off. Idempotent.
 */
export function stripEmailSignature(body: string): string {
  if (!body) return body;

  let next = body.replace(
    /(Creator, (?:\[Crowdsource Choir\]\([^)]+\)|Crowdsource Choir))\n(?:https?:\/\/)?(?:www\.)?crowdsourcechoir\.com(?:\/book)?\/?/gi,
    "Creator, Crowdsource Choir"
  );

  // "--\nJoel DeJong\nCreator, Crowdsource Choir\n'...'\n—American Songwriter" at end
  next = next.replace(
    /\n*\n--\nJoel DeJong\nCreator, (?:\[Crowdsource Choir\]\([^)]+\)|Crowdsource Choir)\n'One of the Pacific Northwest's Most Talented Composers'\n—American Songwriter\s*$/,
    ""
  );

  // Older variant that used {{sender_name}} / Joel DeJong on the Best line before the block
  next = next.replace(
    /\n*\n--\n[^\n]+\nCreator, (?:\[Crowdsource Choir\]\([^)]+\)|Crowdsource Choir)\n'One of the Pacific Northwest's Most Talented Composers'\n—American Songwriter\s*$/,
    ""
  );

  return next.replace(/[ \t]+$/gm, "").replace(/\n+$/, "");
}

/** Append Joel's plain-text signature once. A body that already contains the block is left as-is. */
export function ensureEmailSignature(body: string): string {
  const stripped = stripEmailSignature(body ?? "");
  if (hasEmailSignature(stripped)) return stripped.replace(/\s+$/, "");
  const base = stripped.replace(/\s+$/, "");
  if (!base) return EMAIL_SIGNATURE;
  return `${base}\n\n${EMAIL_SIGNATURE}`;
}

/** HTML form of the signature with "Crowdsource Choir" linked to https://www.crowdsourcechoir.com. */
export function emailSignatureHtml(): string {
  const lines = [
    "--",
    "Joel DeJong",
    `Creator, <a href="${WEBSITE_HREF}" style="color:#1a73e8;text-decoration:underline">Crowdsource Choir</a>`,
    "&#39;One of the Pacific Northwest&#39;s Most Talented Composers&#39;",
    "&mdash;American Songwriter",
  ].join("<br>");
  return `<p style="margin:24px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#222222;">${lines}</p>`;
}

export function ensureEmailSignatureHtml(html: string): string {
  if (!html) return emailSignatureHtml();
  if (hasEmailSignature(html)) {
    // Ensure "Crowdsource Choir" inside an existing signature block is also linked to the website.
    return html.replace(
      /Creator,\s*(?!<a\b)Crowdsource Choir/gi,
      `Creator, <a href="${WEBSITE_HREF}" style="color:#1a73e8;text-decoration:underline">Crowdsource Choir</a>`
    );
  }
  const block = emailSignatureHtml();
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${block}</body>`);
  return `${html}${block}`;
}
