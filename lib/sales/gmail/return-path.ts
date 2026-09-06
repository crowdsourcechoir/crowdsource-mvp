/** Where the browser lands after Google consent. Cookie-carried, so it must be validated both ways. */
export const GMAIL_RETURN_COOKIE = "gmail_oauth_return";
export const GMAIL_DEFAULT_RETURN_PATH = "/admin/sales";

/** Only same-origin admin paths are allowed — never an absolute or protocol-relative URL. */
export function sanitizeGmailReturnPath(raw: string | null | undefined): string {
  if (!raw) return GMAIL_DEFAULT_RETURN_PATH;
  const value = raw.trim();
  if (!value.startsWith("/admin/")) return GMAIL_DEFAULT_RETURN_PATH;
  if (value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return GMAIL_DEFAULT_RETURN_PATH;
  }
  return value.split(/[?#]/)[0];
}
