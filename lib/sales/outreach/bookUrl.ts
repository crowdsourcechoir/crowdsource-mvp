/** Branded experience page for cold outreach — pricing/PDFs wait until they reply. */
export const DEFAULT_BOOK_URL = "https://www.crowdsourcechoir.com/book";

export function bookUrl(): string {
  return process.env.SALES_BOOK_URL?.trim() || DEFAULT_BOOK_URL;
}

/**
 * Replaces legacy "I've attached a one-page overview..." cold-outreach wording with a
 * link to the /book page. Idempotent if the body already has the book URL block.
 */
export function replaceAttachmentWithBookLink(body: string, url: string = bookUrl()): string {
  if (!body) return body;

  const bookBlock = `I've included a bit more about the experience here:\n${url}`;

  // Normalize any existing book block to the configured URL.
  if (/I've included a bit more about the experience here:\s*\nhttps?:\/\/\S+/i.test(body)) {
    return body.replace(
      /I've included a bit more about the experience here:\s*\nhttps?:\/\/\S+/i,
      bookBlock
    );
  }

  let next = body.replace(
    /I've attached a one-page overview(?: of (?:the Anthem Experience|Crowdsource Choir[^.]*))?\.\s*/gi,
    `${bookBlock}\n\n`
  );
  next = next.replaceAll("{{book_url}}", url);
  return next;
}

/** Same rewrite for outreach_templates.body_template (keeps {{book_url}} placeholder). */
export function replaceAttachmentInTemplate(bodyTemplate: string): string {
  if (!bodyTemplate) return bodyTemplate;
  if (/I've included a bit more about the experience here:\s*\n\{\{book_url\}\}/i.test(bodyTemplate)) {
    return bodyTemplate;
  }
  const bookBlock = "I've included a bit more about the experience here:\n{{book_url}}";
  return bodyTemplate.replace(
    /I've attached a one-page overview(?: of (?:the Anthem Experience|Crowdsource Choir[^.]*))?\.\s*/gi,
    `${bookBlock}\n\n`
  );
}
