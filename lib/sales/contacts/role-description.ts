import { isGenericMailboxEmail } from "@/lib/sales/dedupe";
import type { Contact } from "@/lib/sales/types";

/** Human-facing “what this person does” blurb for queue/comms tweaking. */
export function contactRoleDescription(contact: Contact | null | undefined): string | null {
  if (!contact) return null;
  const meta = contact.importMetadata;
  const fromMeta = meta && typeof meta.roleDescription === "string" ? meta.roleDescription.trim() : "";
  if (fromMeta) return fromMeta;
  return null;
}

/** Build a short role blurb from title when none was seeded (fallback). */
export function fallbackRoleDescription(roleTitle: string | null | undefined, email?: string | null): string {
  if (isGenericMailboxEmail(email)) {
    return "Shared inbox — a real person may forward this to whoever produces the event or owns programming.";
  }
  const t = (roleTitle ?? "").toLowerCase();
  if (/coo|chief operating/.test(t)) {
    return "Runs day-to-day business operations; green-lights cross-department initiatives and partners that touch the whole club.";
  }
  if (/game entertainment|special events/.test(t)) {
    return "Owns in-stadium entertainment and special events — the natural owner for live participatory moments, anthems, and training-camp rituals.";
  }
  if (/entertainment experience|programming/.test(t)) {
    return "Designs and produces fan entertainment programming; cares about how moments feel in the building and on broadcast.";
  }
  if (/managing director of marketing|director of marketing|marketing/.test(t)) {
    return "Owns brand, campaigns, and fan-facing marketing narrative — strong fit for belonging/identity stories that scale beyond one game.";
  }
  if (/operations/.test(t)) {
    return "Operations / COO orbit — helps move internal decisions and may route the right owners for new fan experiences.";
  }
  return "Front-office contact — use title + org context to angle the note; confirm ownership before sending.";
}
