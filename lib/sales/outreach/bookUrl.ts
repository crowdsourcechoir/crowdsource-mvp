/** Branded website link for cold outreach — pricing/PDFs wait until they reply. */
export const DEFAULT_BOOK_URL = "www.crowdsourcechoir.com";
export const WEBSITE_HREF_URL = "https://www.crowdsourcechoir.com";

export function bookUrl(): string {
  return process.env.SALES_BOOK_URL?.trim() || DEFAULT_BOOK_URL;
}

function bookBlock(url: string): string {
  return `I've included a bit more about the experience here:\n${url}`;
}

/**
 * Rewrites any `https://www.crowdsourcechoir.com/book` or `www.crowdsourcechoir.com/book`
 * link in plain text, markdown, or HTML email bodies to `www.crowdsourcechoir.com`
 * (keeping `href="https://www.crowdsourcechoir.com"` inside HTML anchor attributes).
 */
export function normalizeCrowdsourceWebsiteLinks(body: string, displayUrl: string = DEFAULT_BOOK_URL): string {
  if (!body) return body;

  let next = body;

  // HTML href attributes: https://www.crowdsourcechoir.com/book -> https://www.crowdsourcechoir.com
  next = next.replace(
    /(href=["'])https?:\/\/(?:www\.)?crowdsourcechoir\.com\/book\/?(["'])/gi,
    `$1${WEBSITE_HREF_URL}$2`
  );

  // Markdown links: [label](https://www.crowdsourcechoir.com/book) -> [label](https://www.crowdsourcechoir.com)
  next = next.replace(
    /(\[[^\]]+\]\()https?:\/\/(?:www\.)?crowdsourcechoir\.com\/book\/?(\))/gi,
    (_m, open: string, close: string) => {
      // If label itself was the /book URL, rewrite label too
      const rewrittenOpen = open.replace(
        /https?:\/\/(?:www\.)?crowdsourcechoir\.com\/book\/?|(?:www\.)?crowdsourcechoir\.com\/book\/?/gi,
        displayUrl
      );
      return `${rewrittenOpen}${WEBSITE_HREF_URL}${close}`;
    }
  );

  // Visible text inside anchor tags or plain text: https://www.crowdsourcechoir.com/book or www.crowdsourcechoir.com/book -> www.crowdsourcechoir.com
  next = next.replace(/https?:\/\/(?:www\.)?crowdsourcechoir\.com\/book\/?/gi, displayUrl);
  next = next.replace(/(?:www\.)?crowdsourcechoir\.com\/book\/?/gi, displayUrl);

  // Also normalize bare https://www.crowdsourcechoir.com in plain text (outside href="..." and markdown (...)) to www.crowdsourcechoir.com
  next = next.replace(/(?<![="(\w])https?:\/\/(?:www\.)?crowdsourcechoir\.com\/?(?![/\w])/gi, displayUrl);

  return next;
}

/**
 * Replaces legacy "I've attached a one-page overview..." cold-outreach wording and any
 * `/book` links with `www.crowdsourcechoir.com`. Idempotent.
 */
export function replaceAttachmentWithBookLink(body: string, url: string = bookUrl()): string {
  if (!body) return body;

  const block = bookBlock(url);

  let next = normalizeCrowdsourceWebsiteLinks(body, url);

  // Normalize any existing book block to the configured URL (ASCII or curly apostrophe).
  const included = /I['\u2019]ve included a bit more about the experience here:\s*\n(?:https?:\/\/)?(?:www\.)?crowdsourcechoir\.com(?:\S*)/i;
  if (included.test(next)) {
    next = next.replace(included, block);
  }

  // Broad match: any "I've attached a one-page overview..." sentence, ASCII or curly apostrophe.
  const attached = /I['\u2019]ve attached a one-page overview[^\n.]*\.\s*/gi;
  next = next.replace(attached, `${block}\n\n`);

  // Last-resort line rewrite if a weird character still blocked the sentence regex.
  if (/attached a one-page/i.test(next) && !/crowdsourcechoir\.com/i.test(next)) {
    next = next
      .split("\n")
      .map((line) => (/attached a one-page/i.test(line) ? block : line))
      .join("\n");
  }

  next = next.replaceAll("{{book_url}}", url);
  return next;
}

/** Same rewrite for outreach_templates.body_template (keeps {{book_url}} placeholder and strips hardcoded /book). */
export function replaceAttachmentInTemplate(bodyTemplate: string): string {
  if (!bodyTemplate) return bodyTemplate;
  let next = normalizeCrowdsourceWebsiteLinks(bodyTemplate, "{{book_url}}");
  const already = /I['\u2019]ve included a bit more about the experience here:\s*\n\{\{book_url\}\}/i;
  if (already.test(next)) return next;
  const block = "I've included a bit more about the experience here:\n{{book_url}}";
  next = next.replace(/I['\u2019]ve attached a one-page overview[^\n.]*\.\s*/gi, `${block}\n\n`);
  if (/attached a one-page/i.test(next)) {
    next = next
      .split("\n")
      .map((line) => (/attached a one-page/i.test(line) ? block : line))
      .join("\n");
  }
  return next;
}
