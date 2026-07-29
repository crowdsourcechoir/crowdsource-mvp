import type { QueueItemDetail } from "../types";
import { resolveProspectWebsite } from "../prospectWebsite";

export type DigestStats = {
  newCount: number;
  backlogCount: number;
  sinceIso: string;
  /** Quality bar applied to the list (e.g. 70). Included in copy so the inbox subject matches the gate. */
  minScore: number;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function contactLine(item: QueueItemDetail): string {
  if (!item.contact) return "No contact on file yet";
  const status = item.contact.emailVerificationStatus;
  const statusLabel = status === "verified_deliverable" ? "verified" : status === "valid_format" ? "valid format" : status;
  const name = item.contact.fullName ?? "Unnamed contact";
  const email = item.contact.email ?? "no email";
  return `${name} — ${item.contact.roleTitle ?? "role unknown"} (${email}, ${statusLabel})`;
}

function websiteLine(item: QueueItemDetail): string | null {
  const site = resolveProspectWebsite({
    eventWebsiteUrl: item.opportunity.eventWebsiteUrl,
    organizationWebsiteUrl: item.organization.websiteUrl,
    findingSourceUrls: item.findings.map((f) => f.sourceUrl),
  });
  if (!site) return null;
  return `${site.label}: ${site.url}`;
}

function itemToPlainLines(item: QueueItemDetail, baseUrl: string): string[] {
  const score = item.score ? `${item.score.totalScore}/100` : "not scored";
  const opportunityUrl = `${baseUrl}/admin/sales/opportunities/${item.opportunity.id}`;
  const website = websiteLine(item);
  return [
    `${item.organization.name} — ${item.opportunity.title} (score: ${score})`,
    `  ${item.opportunityTypeLabel ?? "Uncategorized"}${item.organizationTypeLabel ? ` · ${item.organizationTypeLabel}` : ""}`,
    website ? `  ${website}` : "",
    `  Contact: ${contactLine(item)}`,
    item.queueItem.duplicateWarning ? "  ⚠ possible duplicate — check before approving" : "",
    `  Review: ${opportunityUrl}`,
  ].filter(Boolean);
}

function itemToHtmlBlock(item: QueueItemDetail, baseUrl: string): string {
  const score = item.score ? `${item.score.totalScore}/100` : "not scored";
  const opportunityUrl = `${baseUrl}/admin/sales/opportunities/${item.opportunity.id}`;
  const site = resolveProspectWebsite({
    eventWebsiteUrl: item.opportunity.eventWebsiteUrl,
    organizationWebsiteUrl: item.organization.websiteUrl,
    findingSourceUrls: item.findings.map((f) => f.sourceUrl),
  });
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
        ${
          site
            ? `<div style="font-size:13px;color:#d4d4d8;margin-top:6px;">${escapeHtml(site.label)}: <a href="${escapeHtml(
                site.url
              )}" style="color:#38bdf8;text-decoration:underline;">${escapeHtml(site.url.replace(/^https?:\/\//i, ""))}</a></div>`
            : ""
        }
        <div style="font-size:13px;color:#d4d4d8;margin-top:6px;">Contact: ${escapeHtml(contactLine(item))}</div>
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
  const subject =
    stats.newCount === 0
      ? `Crowdsource Sales: no new ${barLabel} leads yet (still working)`
      : `Crowdsource Sales: ${stats.newCount} new ${barLabel} lead${stats.newCount === 1 ? "" : "s"} ready for review`;

  const introEmpty = `No new opportunities scoring ${barLabel} reached the review queue since the last digest — the pipeline is still working toward that bar.`;
  const introSome = `${stats.newCount} new opportunit${stats.newCount === 1 ? "y" : "ies"} scoring ${barLabel} reached the review queue:`;

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
