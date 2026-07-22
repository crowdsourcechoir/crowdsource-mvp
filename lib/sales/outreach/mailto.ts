/**
 * Builds a `mailto:` URL so "launching" an email opens the reviewer's own default mail client
 * (Mail.app, Outlook, a configured webmail handler, etc.) with recipient/subject/body pre-filled
 * — the human still hits send from their own real inbox. Deliberately not a real send API: this
 * keeps the human-in-the-loop principle intact (see docs/sales-platform/README.md) and lets the
 * reviewer attach the one-sheet themselves, since `mailto:` links can't carry attachments for
 * security reasons across every browser/OS combination.
 *
 * Percent-encodes per RFC 6068 (not `application/x-www-form-urlencoded`'s "+ for space"), which
 * is what the mailto URI scheme actually expects — using URLSearchParams here would silently
 * produce "+" for spaces that some mail clients don't decode correctly.
 */
export function buildMailtoUrl(to: string, subject: string, body: string): string {
  const query = [`subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body)}`].join("&");
  return `mailto:${encodeURIComponent(to)}?${query}`;
}

/**
 * Plain-text rendering of the same draft, used for the clipboard fallback below — a webmail
 * provider like Gmail can only intercept `mailto:` links in a given browser if the user has
 * explicitly granted it protocol-handler permission there (the browser-level permission prompt,
 * or `chrome://settings/handlers`); setting it as the OS-level default mail app does not do this.
 * When that permission was never granted, `mailto:` navigation fails completely silently — no
 * error, no dialog, nothing opens — so every mailto launch in this app is paired with copying
 * this text to the clipboard as a fallback the reviewer can paste into a fresh email themselves.
 */
export function buildEmailPlainText(to: string, subject: string, body: string): string {
  return `To: ${to}\nSubject: ${subject}\n\n${body}`;
}

/**
 * Navigates to a `mailto:` URL via a programmatically created-and-clicked `<a>` element rather
 * than reassigning `window.location.href` — dispatching an actual click is the more broadly-
 * reliable way browsers route custom-protocol navigation to a registered handler. Must be called
 * synchronously within a user-gesture event handler (e.g. a click), before any `await` — some
 * browsers (Safari in particular) revoke the "trusted user gesture" needed for protocol-handler
 * navigation once control returns from an awaited promise.
 */
export function launchMailto(mailtoUrl: string): void {
  if (typeof document === "undefined") return;
  const link = document.createElement("a");
  link.href = mailtoUrl;
  link.rel = "noopener";
  link.style.position = "fixed";
  link.style.top = "-1000px";
  link.style.left = "-1000px";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
