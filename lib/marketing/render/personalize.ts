import type { EmailDocument } from "../document/types";

export type PersonalizationRecipient = {
  first_name?: string | null;
  display_name?: string | null;
  city?: string | null;
  email?: string | null;
  unsubscribe_url: string;
};

const TOKEN = /\{\{(first_name|display_name|city|email|unsubscribe_url)\}\}/g;

function tokenValue(
  name: string,
  recipient: PersonalizationRecipient,
  personalization: EmailDocument["personalization"],
  escape: (value: string) => string
): string {
  if (name === "unsubscribe_url") return escape(recipient.unsubscribe_url);
  const raw =
    name === "first_name"
      ? recipient.first_name
      : name === "display_name"
        ? recipient.display_name
        : name === "city"
          ? recipient.city
          : recipient.email;
  const value = raw?.trim() ?? "";
  if (value) return escape(value);
  if (personalization.missingTokenBehavior === "blank") return "";
  if (name === "first_name") return escape(personalization.fallbacks.first_name ?? "");
  if (name === "display_name") return escape(personalization.fallbacks.display_name ?? "");
  return "";
}

function apply(
  input: string,
  recipient: PersonalizationRecipient,
  personalization: EmailDocument["personalization"],
  escape: (value: string) => string
): string {
  return input.replace(TOKEN, (_match, name: string) => tokenValue(name, recipient, personalization, escape));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

/** Replace allowlisted tokens. HTML values are escaped. Unsubscribe URLs are escaped as attributes. */
export function personalizeEmail(
  parts: { html: string; text: string },
  recipient: PersonalizationRecipient,
  personalization: EmailDocument["personalization"]
): { html: string; text: string } {
  return {
    html: apply(parts.html, recipient, personalization, escapeHtml),
    text: apply(parts.text, recipient, personalization, (value) => value),
  };
}
