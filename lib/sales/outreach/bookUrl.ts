/** Branded experience page for cold outreach — pricing/PDFs wait until they reply. */
export const DEFAULT_BOOK_URL = "https://www.crowdsourcechoir.com/book";

export function bookUrl(): string {
  return process.env.SALES_BOOK_URL?.trim() || DEFAULT_BOOK_URL;
}

function bookBlock(url: string): string {
  return `I've included a bit more about the experience here:\n${url}`;
}

/**
 * Replaces legacy "I've attached a one-page overview..." cold-outreach wording with a
 * link to the /book page. Idempotent if the body already has the book URL block.
 */
export function replaceAttachmentWithBookLink(body: string, url: string = bookUrl()): string {
  if (!body) return body;

  const block = bookBlock(url);

  // Normalize any existing book block to the configured URL (ASCII or curly apostrophe).
  const included = /I['\u2019]ve included a bit more about the experience here:\s*\nhttps?:\/\/\S+/i;
  if (included.test(body)) {
    return body.replace(included, block);
  }

  // Broad match: any "I've attached a one-page overview..." sentence, ASCII or curly apostrophe.
  const attached = /I['\u2019]ve attached a one-page overview[^\n.]*\.\s*/gi;
  let next = body.replace(attached, `${block}\n\n`);

  // Last-resort line rewrite if a weird character still blocked the sentence regex.
  if (/attached a one-page/i.test(next) && !/crowdsourcechoir\.com\/book/i.test(next)) {
    next = next
      .split("\n")
      .map((line) => (/attached a one-page/i.test(line) ? block : line))
      .join("\n");
  }

  next = next.replaceAll("{{book_url}}", url);
  return next;
}

/** Same rewrite for outreach_templates.body_template (keeps {{book_url}} placeholder). */
export function replaceAttachmentInTemplate(bodyTemplate: string): string {
  if (!bodyTemplate) return bodyTemplate;
  const already = /I['\u2019]ve included a bit more about the experience here:\s*\n\{\{book_url\}\}/i;
  if (already.test(bodyTemplate)) return bodyTemplate;
  const block = "I've included a bit more about the experience here:\n{{book_url}}";
  let next = bodyTemplate.replace(/I['\u2019]ve attached a one-page overview[^\n.]*\.\s*/gi, `${block}\n\n`);
  if (/attached a one-page/i.test(next)) {
    next = next
      .split("\n")
      .map((line) => (/attached a one-page/i.test(line) ? block : line))
      .join("\n");
  }
  return next;
}
