import { normalizeMarketingEmail } from "../ids";
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
  confirmedAt?: string | null;
};

export type MailchimpCsvSummary = {
  parsed: number;
  missingEmail: number;
  invalidEmail: number;
  duplicateEmails: number;
  subscribed: number;
  unsubscribed: number;
  cleaned: number;
  pending: number;
  withRegion: number;
  withCountry: number;
  withGroups: number;
  withConfirmTime: number;
};

export function mapMailchimpStatus(raw: string | null | undefined): MarketingStatus {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "unsubscribed" || s === "unsub") return "unsubscribed";
  if (s === "cleaned" || s === "bounced" || s === "archived") return "cleaned";
  if (s === "pending" || s === "transactional") return "pending";
  return "subscribed";
}

export function parseMailchimpTags(raw: MailchimpImportRow["tags"]): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).map((tag) => tag.trim()).filter(Boolean);
  return raw
    .split(/[,|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function headerKey(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function findHeader(headers: string[], names: string[]): number {
  for (const name of names) {
    const index = headers.indexOf(name);
    if (index >= 0) return index;
  }
  return -1;
}

function cell(cols: string[], index: number): string {
  if (index < 0) return "";
  return cols[index]?.trim() ?? "";
}

function parseAddress(raw: string): { city: string | null; region: string | null; country: string | null } {
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 6) {
    return { city: parts[2] || null, region: parts[3] || null, country: parts[5] || null };
  }
  if (parts.length >= 4) {
    const stateZip = parts[parts.length - 2] ?? "";
    const region = stateZip.split(/\s+/)[0] || null;
    return { city: parts[parts.length - 3] || null, region, country: parts[parts.length - 1] || null };
  }
  return { city: null, region: null, country: null };
}

function parseConfirmTime(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value);
  const normalized = hasZone ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function splitCsvRecords(csv: string): string[][] {
  const text = csv.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cur);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur);
    if (row.some((item) => item.trim())) rows.push(row);
  }
  return rows;
}

function groupTags(headers: string[], cols: string[], groupsIdx: number): string[] {
  const tags: string[] = [];
  if (groupsIdx >= 0) {
    for (const interest of cell(cols, groupsIdx).split(/[,|]/)) {
      const name = interest.trim();
      if (name) tags.push(`group:${name}`);
    }
  }
  headers.forEach((header, index) => {
    if (!header.startsWith("group:") && !header.startsWith("interest:")) return;
    const value = cell(cols, index);
    if (!value) return;
    const label = header.slice(header.indexOf(":") + 1).trim();
    for (const interest of value.split(/[,|]/)) {
      const name = interest.trim();
      if (!name) continue;
      tags.push(label ? `group:${label}:${name}` : `group:${name}`);
    }
  });
  return tags;
}

/** Every valid data row, in file order. Blank email rows are omitted. */
export function parseMailchimpCsv(csv: string): MailchimpImportRow[] {
  return inspectMailchimpCsv(csv).rows;
}

export function inspectMailchimpCsv(csv: string): { rows: MailchimpImportRow[]; summary: MailchimpCsvSummary } {
  const records = splitCsvRecords(csv);
  const headers = (records[0] ?? []).map(headerKey);
  const emailIdx = findHeader(headers, ["email address", "email", "emailaddress"]);
  const emptySummary: MailchimpCsvSummary = {
    parsed: 0,
    missingEmail: 0,
    invalidEmail: 0,
    duplicateEmails: 0,
    subscribed: 0,
    unsubscribed: 0,
    cleaned: 0,
    pending: 0,
    withRegion: 0,
    withCountry: 0,
    withGroups: 0,
    withConfirmTime: 0,
  };
  if (emailIdx < 0 || records.length < 2) return { rows: [], summary: emptySummary };

  const nameIdx = findHeader(headers, ["full name", "fullname", "name"]);
  const firstIdx = findHeader(headers, ["first name", "fname", "first"]);
  const lastIdx = findHeader(headers, ["last name", "lname", "last"]);
  const cityIdx = findHeader(headers, ["city", "location"]);
  const regionIdx = findHeader(headers, ["state", "region", "province", "st"]);
  const countryIdx = findHeader(headers, ["country"]);
  const statusIdx = findHeader(headers, ["member status", "subscription status", "status"]);
  const tagsIdx = findHeader(headers, ["tags", "tag"]);
  const groupsIdx = findHeader(headers, ["interests", "groups", "group"]);
  const idIdx = findHeader(headers, ["euid", "member id", "mailchimp id", "id", "leid"]);
  const confirmIdx = findHeader(headers, ["confirm time", "optin time", "opt in time"]);
  const addressIdx = findHeader(headers, ["address"]);

  const rows: MailchimpImportRow[] = [];
  let missingEmail = 0;
  let invalidEmail = 0;
  for (const cols of records.slice(1)) {
    const email = cell(cols, emailIdx);
    if (!email) {
      missingEmail += 1;
      continue;
    }
    if (!normalizeMarketingEmail(email)) {
      invalidEmail += 1;
      continue;
    }
    const displayName =
      cell(cols, nameIdx) || [cell(cols, firstIdx), cell(cols, lastIdx)].filter(Boolean).join(" ") || null;
    const address = addressIdx >= 0 ? parseAddress(cell(cols, addressIdx)) : { city: null, region: null, country: null };
    const city = cell(cols, cityIdx) || address.city;
    const region = cell(cols, regionIdx) || address.region;
    const country = cell(cols, countryIdx) || address.country;
    const groups = groupTags(headers, cols, groupsIdx);
    const tags = [...parseMailchimpTags(tagsIdx >= 0 ? cell(cols, tagsIdx) : null), ...groups];
    rows.push({
      email,
      displayName,
      city: city || null,
      region: region || null,
      country: country || null,
      status: statusIdx >= 0 ? cell(cols, statusIdx) || null : "subscribed",
      tags,
      mailchimpId: cell(cols, idIdx) || null,
      confirmedAt: parseConfirmTime(cell(cols, confirmIdx)),
    });
  }

  const unique = dedupeMailchimpRows(rows);
  const summary: MailchimpCsvSummary = {
    parsed: unique.length,
    missingEmail,
    invalidEmail,
    duplicateEmails: rows.length - unique.length,
    subscribed: 0,
    unsubscribed: 0,
    cleaned: 0,
    pending: 0,
    withRegion: unique.filter((row) => row.region).length,
    withCountry: unique.filter((row) => row.country).length,
    withGroups: unique.filter((row) => parseMailchimpTags(row.tags).some((tag) => tag.toLowerCase().startsWith("group:"))).length,
    withConfirmTime: unique.filter((row) => row.confirmedAt).length,
  };
  for (const row of unique) summary[mapMailchimpStatus(row.status)] += 1;
  return { rows, summary };
}

/** Last row for each email wins. Invalid emails are dropped. */
export function dedupeMailchimpRows(rows: MailchimpImportRow[]): MailchimpImportRow[] {
  const byEmail = new Map<string, MailchimpImportRow>();
  for (const row of rows) {
    const email = normalizeMarketingEmail(row.email);
    if (!email) continue;
    byEmail.set(email, row);
  }
  return Array.from(byEmail.values());
}
