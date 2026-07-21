#!/usr/bin/env node
// One-off seed import for "Crowdsource_Fan_Culture_CRM_real_contacts_v1.csv" — see docs/sales-platform/data-import.md.
// Usage: node scripts/sales/import-fan-culture-csv.mjs ["/path/to/file.csv"]
import { readFileSync } from "fs";
import {
  loadEnvLocal,
  getSupabaseAdmin,
  parseCsv,
  findOrCreateOrganization,
  createImportPipelineRun,
  createImportedFinding,
  getOrCreateIndustrySegmentId,
  getOrganizationTypeId,
  findExistingContactByEmailOrName,
  normalizeEmail,
} from "./_shared.mjs";

loadEnvLocal();

const CSV_PATH = process.argv[2] || "/Users/joeldejong/Desktop/Crowdsource_Fan_Culture_CRM_real_contacts_v1.csv";

// Unlike the conferences file, this category is unambiguous enough to set organization_type_id
// directly at import time (see docs/sales-platform/data-import.md for the reasoning).
const CATEGORY_TO_ORG_TYPE_KEY = {
  University: "university",
  Baseball: "sports_team",
  Soccer: "sports_team",
  Hockey: "sports_team",
  Basketball: "sports_team",
};
const CATEGORY_TO_SEGMENT_KEY = {
  University: "education",
  Baseball: "sports_entertainment",
  Soccer: "sports_entertainment",
  Hockey: "sports_entertainment",
  Basketball: "sports_entertainment",
};

async function main() {
  const db = getSupabaseAdmin();
  const text = readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(text);
  console.log(`Parsed ${rows.length} rows from ${CSV_PATH}`);

  const importedAt = new Date().toISOString();
  const pipelineRunByOrgId = new Map();
  const orgTypeIdCache = new Map();

  let organizationsCreated = 0;
  let organizationsMatched = 0;
  let contactsCreated = 0;
  let contactsSkippedDuplicate = 0;

  for (const row of rows) {
    const name = row["Organization"]?.trim();
    if (!name) continue;

    const category = row["Category"]?.trim();
    const orgTypeKey = CATEGORY_TO_ORG_TYPE_KEY[category] ?? null;
    const segmentKey = CATEGORY_TO_SEGMENT_KEY[category] ?? null;
    if (segmentKey) await getOrCreateIndustrySegmentId(db, segmentKey, category);

    const websiteUrl = row["Website"]?.trim() || null;
    const { organization, created } = await findOrCreateOrganization(db, {
      name,
      websiteUrl,
      importMetadata: { ...row, sourceFile: "Crowdsource_Fan_Culture_CRM_real_contacts_v1.csv", importedAt },
      industrySegmentKeyHint: segmentKey,
    });
    if (created) organizationsCreated += 1;
    else organizationsMatched += 1;

    if (created && orgTypeKey && !organization.organization_type_id) {
      if (!orgTypeIdCache.has(orgTypeKey)) orgTypeIdCache.set(orgTypeKey, await getOrganizationTypeId(db, orgTypeKey));
      const orgTypeId = orgTypeIdCache.get(orgTypeKey);
      if (orgTypeId) {
        await db
          .from("organizations")
          .update({
            organization_type_id: orgTypeId,
            location_city: row["City"]?.trim() || null,
            location_region: row["State"]?.trim() || null,
          })
          .eq("id", organization.id);
      }
    }

    let pipelineRun = pipelineRunByOrgId.get(organization.id);
    if (!pipelineRun) {
      pipelineRun = await createImportPipelineRun(db, organization.id);
      pipelineRunByOrgId.set(organization.id, pipelineRun);
    }

    const contactName = row["Contact Name"]?.trim();
    const email = row["Email"]?.trim() || null;
    if (contactName) {
      const existing = await findExistingContactByEmailOrName(db, organization.id, email, contactName);
      if (existing) {
        contactsSkippedDuplicate += 1;
      } else {
        const { error: contactError } = await db.from("contacts").insert({
          organization_id: organization.id,
          full_name: contactName,
          role_title: row["Title"]?.trim() || null,
          role_category: row["Contact Type"]?.trim() || null,
          email,
          normalized_email: normalizeEmail(email),
          phone: row["Phone"]?.trim() || null,
          source: "csv_import",
          email_verification_status: "unverified",
          import_metadata: { ...row, sourceFile: "Crowdsource_Fan_Culture_CRM_real_contacts_v1.csv", importedAt },
        });
        if (contactError) {
          console.error(`  ! Failed to create contact "${contactName}" for "${name}": ${contactError.message}`);
        } else {
          contactsCreated += 1;
        }
      }

      const sourceUrl = row["Source URL"]?.trim();
      if (sourceUrl) {
        await createImportedFinding(db, {
          pipelineRunId: pipelineRun.id,
          organizationId: organization.id,
          opportunityId: null,
          url: sourceUrl,
          claimType: "decision_maker",
          claimText: `${contactName}${row["Title"] ? `, ${row["Title"].trim()}` : ""} found on the organization's staff directory (contact type: ${row["Contact Type"]?.trim() || "unspecified"}).`,
        });
      }
    }
  }

  console.log("\nDone.");
  console.log(`Organizations created: ${organizationsCreated}, matched existing: ${organizationsMatched}`);
  console.log(`Contacts created: ${contactsCreated}, skipped as duplicate: ${contactsSkippedDuplicate}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
