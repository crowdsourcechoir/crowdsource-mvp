/**
 * Gmail (and other mail clients) already append Joel's signature when a draft is launched via
 * mailto:, so the app must NOT embed the press-quote block in outreach bodies — that produced
 * a duplicate signature. These helpers strip any previously embedded block.
 */

const SIGNATURE_MARKER = "One of the Pacific Northwest's Most Talented Composers";

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

/** @deprecated Use stripEmailSignature — we no longer embed signatures in drafts. */
export function ensureEmailSignature(body: string): string {
  return stripEmailSignature(body);
}
