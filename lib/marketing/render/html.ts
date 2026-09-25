const TOKEN = /\{\{(first_name|display_name|city|email|unsubscribe_url)\}\}/g;

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

/** Escape text while leaving allowlisted {{tokens}} for personalize.ts. */
export function escapePreservingTokens(value: string): string {
  const parts = value.split(TOKEN);
  let html = "";
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i] ?? "";
    html += i % 2 === 1 ? `{{${part}}}` : escapeHtml(part);
  }
  return html;
}

export function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value)) return value;
  return null;
}
