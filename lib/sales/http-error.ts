/** Operator-facing API/UI errors. Never pass Cloudflare/HTML bodies through to the page. */

const HTML_OR_CDN = /<!DOCTYPE|<html[\s>]|<\/html>|Cloudflare Ray ID|Error 5\d\d/i;
const UNREACHABLE =
  /522:|connection timed out|timed out|timeout|ETIMEDOUT|ECONNRESET|fetch failed|Can't reach the database|database is temporarily unreachable/i;

export function publicErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  let text = "";
  if (typeof err === "string") text = err;
  else if (err instanceof Error) text = err.message;
  else if (err && typeof err === "object" && "error" in err) {
    const nested = (err as { error: unknown }).error;
    if (typeof nested === "string") text = nested;
  }
  text = text.trim();
  if (!text) return fallback;
  if (HTML_OR_CDN.test(text) || UNREACHABLE.test(text) || text.length > 280) {
    return "The database is temporarily unreachable. Wait a minute and retry.";
  }
  return text;
}

export async function readApiJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text || `HTTP ${res.status}` };
  }
}

export function apiErrorFromBody(data: unknown, fallback: string): string {
  const raw =
    data && typeof data === "object" && "error" in data ? (data as { error: unknown }).error : null;
  return publicErrorMessage(raw ?? fallback, fallback);
}
