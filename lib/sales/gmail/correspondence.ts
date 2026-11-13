/**
 * Gmail search for mail to, from, or cc'd to specific people.
 * Excludes chats. Does not invent addresses.
 */
export function gmailCorrespondenceQuery(emails: string[]): string | null {
  const unique: string[] = [];
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (!unique.includes(email)) unique.push(email);
  }
  if (unique.length === 0) return null;
  const people = unique.map((email) => `(from:${email} OR to:${email} OR cc:${email})`).join(" OR ");
  return `(${people}) -in:chats`;
}
