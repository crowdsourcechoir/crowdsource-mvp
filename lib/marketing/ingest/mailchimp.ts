import { upsertMarketingPerson } from "../people";
import type { MarketingStatus } from "../types";

export type MailchimpImportRow = {
  email: string;
  displayName?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  status?: string | null;
  tags?: string[] | string | null;
  mailchimpId?: string | null;
};

function mapStatus(raw: string | null | undefined): MarketingStatus {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "unsubscribed" || s === "unsub") return "unsubscribed";
  if (s === "cleaned" || s === "bounced" || s === "archived") return "cleaned";
  if (s === "pending" || s === "transactional") return "pending";
  return "subscribed";
}

function parseTags(raw: MailchimpImportRow["tags"]): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).map((t) => t.trim()).filter(Boolean);
  return raw
    .split(/[,|]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Parse a simple CSV with header row into Mailchimp-like rows. */
export function parseMailchimpCsv(csv: string): MailchimpImportRow[] {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const emailIdx = headers.findIndex((h) => h === "email" || h === "email address" || h === "emailaddress");
  if (emailIdx < 0) return [];
  const nameIdx = headers.findIndex((h) => h === "name" || h === "full name" || h === "fullname");
  const firstIdx = headers.findIndex((h) => h === "first name" || h === "fname");
  const lastIdx = headers.findIndex((h) => h === "last name" || h === "lname");
  const cityIdx = headers.findIndex((h) => h === "city" || h === "mmerness_city" || h === "location");
  const statusIdx = headers.findIndex((h) => h === "status" || h === "member status" || h === "subscription status");
  const tagsIdx = headers.findIndex((h) => h === "tags" || h === "tag");
  const idIdx = headers.findIndex((h) => h === "id" || h === "member id" || h === "mailchimp id");

  const rows: MailchimpImportRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const email = cols[emailIdx]?.trim();
    if (!email) continue;
    const displayName =
      (nameIdx >= 0 ? cols[nameIdx] : null) ||
      [firstIdx >= 0 ? cols[firstIdx] : "", lastIdx >= 0 ? cols[lastIdx] : ""].join(" ").trim() ||
      null;
    rows.push({
      email,
      displayName,
      city: cityIdx >= 0 ? cols[cityIdx]?.trim() || null : null,
      status: statusIdx >= 0 ? cols[statusIdx]?.trim() || null : "subscribed",
      tags: tagsIdx >= 0 ? cols[tagsIdx] ?? null : null,
      mailchimpId: idIdx >= 0 ? cols[idIdx]?.trim() || null : null,
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export async function importMailchimpRows(rows: MailchimpImportRow[]): Promise<{
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const status = mapStatus(row.status);
    const consent = status === "subscribed";
    const result = await upsertMarketingPerson({
      email: row.email,
      displayName: row.displayName,
      city: row.city,
      region: row.region,
      country: row.country,
      status,
      marketingConsent: consent,
      consentSource: "mailchimp_import",
      acquisitionSource: "mailchimp",
      tags: parseTags(row.tags),
      mailchimpId: row.mailchimpId,
      respectSuppression: true,
    });
    if (!result.ok) {
      errors.push(`${row.email}: ${result.error}`);
      skipped += 1;
      continue;
    }
    if (result.skippedReason) skipped += 1;
    else if (result.created) created += 1;
    else updated += 1;
  }

  return { created, updated, skipped, errors: errors.slice(0, 20) };
}
