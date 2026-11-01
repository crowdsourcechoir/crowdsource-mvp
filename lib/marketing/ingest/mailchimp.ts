import { upsertMarketingPerson } from "../people";
import {
  dedupeMailchimpRows,
  mapMailchimpStatus,
  parseMailchimpCsv,
  parseMailchimpTags,
  type MailchimpImportRow,
} from "./mailchimp-csv";

export type { MailchimpImportRow } from "./mailchimp-csv";
export { dedupeMailchimpRows, inspectMailchimpCsv, parseMailchimpCsv, parseMailchimpTags } from "./mailchimp-csv";

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

  for (const row of dedupeMailchimpRows(rows)) {
    const status = mapMailchimpStatus(row.status);
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
      tags: parseMailchimpTags(row.tags),
      mailchimpId: row.mailchimpId,
      confirmedAt: row.confirmedAt,
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
