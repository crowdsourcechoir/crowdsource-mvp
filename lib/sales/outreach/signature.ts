/**
 * Joel's press-quote signature. Outreach drafts stay unsigned in storage (the LLM and the
 * queue editor work on the letter body only). The send / copy / mailto path appends this
 * block so every outbound sales email gets the same footer without duplicating it.
 */

export const EMAIL_SIGNATURE_QUOTE = "One of the Pacific Northwest's Most Talented Composers";

export const EMAIL_SIGNATURE_PLAIN = [
  "--",
  "Joel DeJong",
  "Creator, Crowdsource Choir",
  `"${EMAIL_SIGNATURE_QUOTE}"`,
  "—American Songwriter",
].join("\n");

export const EMAIL_SIGNATURE_HTML = [
  "--<br>",
  "Joel DeJong<br>",
  "Creator, Crowdsource Choir<br>",
  `<i style="font-style:italic">"${EMAIL_SIGNATURE_QUOTE}"</i><br>`,
  "—American Songwriter",
].join("\n");

const SIGNATURE_MARKER = EMAIL_SIGNATURE_QUOTE;

/** True when the body includes the press-quote signature block. */
export function hasEmailSignature(body: string): boolean {
  return body.includes(SIGNATURE_MARKER);
}

const TRAILING_SIGNATURE_RE = new RegExp(
  [
    "\\n*",
    "\\n--\\s*",
    "\\nJoel DeJong",
    "\\nCreator, Crowdsource Choir",
    "(?:\\nhttps?:\\/\\/(?:www\\.)?crowdsourcechoir\\.com\\/?)?",
    `\\n(?:<(?:em|i)[^>]*>)?["'\\u2018\\u2019\\u201c\\u201d]?${SIGNATURE_MARKER.replace(/'/g, "\\'")}["'\\u2018\\u2019\\u201c\\u201d]?(?:<\\/(?:em|i)>)?`,
    "\\n—American Songwriter\\s*$",
  ].join(""),
  "i"
);

const TRAILING_SIGNATURE_ANY_NAME_RE = new RegExp(
  [
    "\\n*",
    "\\n--\\s*",
    "\\n[^\\n]+",
    "\\nCreator, Crowdsource Choir",
    "(?:\\nhttps?:\\/\\/(?:www\\.)?crowdsourcechoir\\.com\\/?)?",
    `\\n(?:<(?:em|i)[^>]*>)?["'\\u2018\\u2019\\u201c\\u201d]?${SIGNATURE_MARKER.replace(/'/g, "\\'")}["'\\u2018\\u2019\\u201c\\u201d]?(?:<\\/(?:em|i)>)?`,
    "\\n—American Songwriter\\s*$",
  ].join(""),
  "i"
);

/**
 * Removes a trailing Crowdsource Choir press-quote signature (plain text, HTML em, or an
 * older URL line between title and quote). Idempotent.
 */
export function stripEmailSignature(body: string): string {
  if (!body) return body;

  let next = body.replace(
    /(Creator, Crowdsource Choir)\nhttps?:\/\/(?:www\.)?crowdsourcechoir\.com\/?/g,
    "$1"
  );

  next = next.replace(TRAILING_SIGNATURE_RE, "");
  next = next.replace(TRAILING_SIGNATURE_ANY_NAME_RE, "");

  return next.replace(/[ \t]+$/gm, "").replace(/\n+$/, "");
}

/** Appends the press-quote signature if it is not already present. Idempotent. */
export function ensureEmailSignature(body: string): string {
  const stripped = stripEmailSignature(body).replace(/\s+$/, "");
  if (!stripped) return EMAIL_SIGNATURE_PLAIN;
  return `${stripped}\n\n${EMAIL_SIGNATURE_PLAIN}`;
}
