/** Operator-facing API/UI errors. Never pass Cloudflare/HTML bodies through to the page. */

export const DATABASE_UNREACHABLE_MESSAGE =
  "The database is temporarily unreachable. Wait a minute and retry.";

const HTML_OR_CDN = /<!DOCTYPE|<html[\s>]|<\/html>|Cloudflare Ray ID|Error 5\d\d/i;
const UNREACHABLE =
  /522:|connection timed out|timed out|timeout|ETIMEDOUT|ECONNRESET|fetch failed|TypeError|AbortError|This operation was aborted|upstream connect error|connection termination|Can't reach the database|database is temporarily unreachable/i;

function errorName(err: unknown): string {
  if (err instanceof Error) return err.name;
  if (err && typeof err === "object" && "name" in err && typeof (err as { name: unknown }).name === "string") {
    return (err as { name: string }).name;
  }
  return "";
}

export function publicErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  const name = errorName(err);
  if (name === "TypeError" || name === "AbortError" || name === "TimeoutError") {
    return DATABASE_UNREACHABLE_MESSAGE;
  }
  let text = "";
  if (typeof err === "string") text = err;
  else if (err instanceof Error) text = `${err.name}: ${err.message}`;
  else if (err && typeof err === "object" && "error" in err) {
    const nested = (err as { error: unknown }).error;
    if (typeof nested === "string") text = nested;
  }
  text = text.trim();
  if (!text) return fallback;
  if (HTML_OR_CDN.test(text) || UNREACHABLE.test(text) || text.length > 280) {
    return DATABASE_UNREACHABLE_MESSAGE;
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
