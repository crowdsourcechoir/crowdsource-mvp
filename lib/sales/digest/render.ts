import type { Contact, QueueItemDetail } from "../types";
import { digestCategoryLabel } from "./qualify";
import { getDigestCategoryFilter } from "./config";
import type { QueueCategoryFilter } from "../queue/category";
import { MAX_HUNTER_CONTACTS_PER_ORG, hunterPersonRank } from "../enrichment/hunter-org-budget";
import { hasVerifiedEmail } from "../dedupe";

export type DigestStats = {
  newCount: number;
  backlogCount: number;
  sinceIso: string;
  /** Quality bar applied to the list (e.g. 70). Included in copy so the inbox subject matches the gate. */
  minScore: number;
  /** Queue category included in this send (default conferences). */
  category?: QueueCategoryFilter;
};

/** Digest shows at most top-3 contacts — matches Hunter per-org credit cap. */
export const MAX_DIGEST_CONTACTS_PER_ORG = MAX_HUNTER_CONTACTS_PER_ORG;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function formatContactLine(contact: Contact): string {
  const status = contact.emailVerificationStatus;
  const statusLabel =
    status === "verified_deliverable" ? "verified" : status === "valid_format" ? "valid format" : status ?? "unknown";
  const name = contact.fullName ?? "Unnamed contact";
  const email = contact.email ?? "no email";
  return `${name} — ${contact.roleTitle ?? "role unknown"} (${email}, ${statusLabel})`;
}

/** Rank selectable contacts: verified/email first, then seniority — cap at top 3. */
export function pickDigestContacts(item: QueueItemDetail, limit = MAX_DIGEST_CONTACTS_PER_ORG): Contact[] {
  const pool = item.contacts.length > 0 ? item.contacts : item.contact ? [item.contact] : [];
  if (pool.length === 0) return [];
  const ranked = [...pool].sort((a, b) => {
    const emailRank = (c: Contact) => (hasVerifiedEmail(c) ? 0 : c.email ? 1 : 2);
    const byEmail = emailRank(a) - emailRank(b);
    if (byEmail !== 0) return byEmail;
    return (
      hunterPersonRank({ seniority: null, position: b.roleTitle, confidence: null }) -
      hunterPersonRank({ seniority: null, position: a.roleTitle, confidence: null })
    );
  });
  // Keep primary draft contact first when present.
  if (item.contact) {
    const primaryId = item.contact.id;
    ranked.sort((a, b) => Number(b.id === primaryId) - Number(a.id === primaryId));
  }
  const seen = new Set<string>();
  const out: Contact[] = [];
  for (const c of ranked) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

function contactLines(item: QueueItemDetail): string[] {
  const contacts = pickDigestContacts(item);
  if (contacts.length === 0) return ["No contact on file yet"];
  if (contacts.length === 1) return [`Contact: ${formatContactLine(contacts[0]!)}`];
  return contacts.map((c, i) => `Contact ${i + 1}: ${formatContactLine(c)}`);
}

function itemToPlainLines(item: QueueItemDetail, baseUrl: string): string[] {
  const score = item.score ? `${item.score.totalScore}/100` : "not scored";
  const opportunityUrl = `${baseUrl}/admin/sales/opportunities/${item.opportunity.id}`;
  return [
    `${item.organization.name} — ${item.opportunity.title} (score: ${score})`,
    `  ${item.opportunityTypeLabel ?? "Uncategorized"}${item.organizationTypeLabel ? ` · ${item.organizationTypeLabel}` : ""}`,
    ...contactLines(item).map((line) => `  ${line}`),
    item.queueItem.duplicateWarning ? "  ⚠ possible duplicate — check before approving" : "",
    `  Review: ${opportunityUrl}`,
  ].filter(Boolean);
}

function itemToHtmlBlock(item: QueueItemDetail, baseUrl: string): string {
  const score = item.score ? `${item.score.totalScore}/100` : "not scored";
  const opportunityUrl = `${baseUrl}/admin/sales/opportunities/${item.opportunity.id}`;
  const contactsHtml = contactLines(item)
    .map(
      (line) =>
        `<div style="font-size:13px;color:#d4d4d8;margin-top:4px;">${escapeHtml(line)}</div>`
    )
    .join("");
  return `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #27272a;">
        <div style="font-size:15px;font-weight:600;color:#f4f4f5;">
          ${escapeHtml(item.organization.name)} — ${escapeHtml(item.opportunity.title)}
        </div>
        <div style="font-size:13px;color:#a1a1aa;margin-top:2px;">
          Score ${escapeHtml(score)} · ${escapeHtml(item.opportunityTypeLabel ?? "Uncategorized")}${
            item.organizationTypeLabel ? ` · ${escapeHtml(item.organizationTypeLabel)}` : ""
          }
        </div>
        ${contactsHtml}
        ${
          item.queueItem.duplicateWarning
            ? `<div style="font-size:13px;color:#fbbf24;margin-top:4px;">⚠ Possible duplicate — check before approving</div>`
            : ""
        }
        <div style="margin-top:8px;">
          <a href="${opportunityUrl}" style="font-size:13px;color:#a3e635;text-decoration:none;">Review this opportunity →</a>
        </div>
      </td>
    </tr>`;
}

export function renderDigestEmail(items: QueueItemDetail[], stats: DigestStats, baseUrl: string): { subject: string; html: string; text: string } {
  const queueUrl = `${baseUrl}/admin/sales/queue`;
  const barLabel = `${stats.minScore}+`;
  const category = stats.category ?? getDigestCategoryFilter();
  const categoryLabel = digestCategoryLabel(category);
  const noun =
    category === "all"
      ? "orgs"
      : category === "conferences"
        ? "conference orgs"
        : `${categoryLabel.toLowerCase()} orgs`;
  const introEmpty = `No new ${noun} scoring ${barLabel} reached the review queue since the last digest — the pipeline is still working toward that bar.`;
  const introSome = `${stats.newCount} net-new ${noun} scoring ${barLabel} reached the review queue:`;
  const subject =
    stats.newCount === 0
      ? `Crowdsource Sales: no new ${barLabel} ${noun} yet (still working)`
      : `Crowdsource Sales: ${stats.newCount} net-new ${barLabel} ${noun} ready for review`;

  const text = [
    stats.newCount === 0 ? introEmpty : introSome,
    "",
    ...items.flatMap((item) => [...itemToPlainLines(item, baseUrl), ""]),
    `Total pending backlog: ${stats.backlogCount}`,
    `Full queue: ${queueUrl}`,
  ].join("\n");

  const html = `
  <div style="background:#09090b;padding:24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;">
      <h2 style="color:#f4f4f5;font-size:18px;margin:0 0 4px;">Crowdsource Sales — morning digest</h2>
      <p style="color:#a1a1aa;font-size:13px;margin:0 0 20px;">
        ${stats.newCount === 0 ? escapeHtml(introEmpty) : escapeHtml(introSome)}
      </p>
      <table style="width:100%;border-collapse:collapse;">
        ${items.map((item) => itemToHtmlBlock(item, baseUrl)).join("")}
      </table>
      <p style="color:#a1a1aa;font-size:13px;margin-top:20px;">
        Total pending backlog: <strong style="color:#f4f4f5;">${stats.backlogCount}</strong>
      </p>
      <a href="${queueUrl}" style="display:inline-block;margin-top:8px;background:#a3e635;color:#09090b;font-size:13px;font-weight:600;text-decoration:none;padding:10px 16px;border-radius:8px;">
        Open the full queue
      </a>
    </div>
  </div>`;

  return { subject, html, text };
}
