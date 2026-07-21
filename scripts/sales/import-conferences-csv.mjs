#!/usr/bin/env node
// One-off seed import for the "Conferences CRM data.csv" file — see docs/sales-platform/data-import.md.
// Usage: node scripts/sales/import-conferences-csv.mjs ["/path/to/Conferences CRM data.csv"]
import { readFileSync } from "fs";
import {
  loadEnvLocal,
  getSupabaseAdmin,
  parseCsv,
  findOrCreateOrganization,
  createImportPipelineRun,
  createImportedFinding,
  getOrCreateIndustrySegmentId,
  getOpportunityTypeId,
} from "./_shared.mjs";

loadEnvLocal();

const CSV_PATH = process.argv[2] || "/Users/joeldejong/Desktop/Conferences CRM data.csv";

const CATEGORY_TO_SEGMENT_KEY = {
  "Education": "education",
  "Healthcare": "healthcare",
  "Associations / Leadership": "associations_leadership",
  "AI / Innovation / Startup": "tech_innovation",
  "Tech / SaaS / Customer Conference": "tech_innovation",
  "Nonprofit / Civic / Arts": "nonprofit_community",
  "Marketing / Events / Travel": "marketing_events_travel",
};

async function main() {
  const db = getSupabaseAdmin();
  const text = readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(text);
  console.log(`Parsed ${rows.length} rows from ${CSV_PATH}`);

  const annualConferenceTypeId = await getOpportunityTypeId(db, "annual_conference");
  const importedAt = new Date().toISOString();
  const pipelineRunByOrgId = new Map();

  let organizationsCreated = 0;
  let organizationsMatched = 0;
  let opportunitiesCreated = 0;
  let opportunitiesSkippedDuplicate = 0;

  for (const row of rows) {
    const name = row["Organization"]?.trim();
    if (!name) continue;

    const category = row["Category"]?.trim();
    const segmentKey = CATEGORY_TO_SEGMENT_KEY[category] ?? null;
    const segmentId = segmentKey ? await getOrCreateIndustrySegmentId(db, segmentKey, category) : null;

    const sourceUrl = row["Source / Start URL"]?.trim() || null;

    const { organization, created } = await findOrCreateOrganization(db, {
      name,
      websiteUrl: sourceUrl,
      importMetadata: { ...row, sourceFile: "Conferences CRM data.csv", importedAt },
      industrySegmentKeyHint: segmentKey,
    });
    if (created) organizationsCreated += 1;
    else organizationsMatched += 1;
    void segmentId; // stored via import_metadata.industrySegmentKeyHint; organization_type_id is left for pipeline stage 1 to classify.

    let pipelineRun = pipelineRunByOrgId.get(organization.id);
    if (!pipelineRun) {
      pipelineRun = await createImportPipelineRun(db, organization.id);
      pipelineRunByOrgId.set(organization.id, pipelineRun);
    }

    const eventName = row["Annual Gathering / Event"]?.trim();
    const title = eventName || `${name} — imported opportunity`;

    const { data: existingOpp } = await db
      .from("opportunities")
      .select("id")
      .eq("organization_id", organization.id)
      .maybeSingle(); // one opportunity per organization by product decision — first row wins if an org appears twice in the CSV

    if (existingOpp) {
      opportunitiesSkippedDuplicate += 1;
      continue;
    }

    const { data: opportunity, error: oppError } = await db
      .from("opportunities")
      .insert({
        organization_id: organization.id,
        opportunity_type_id: annualConferenceTypeId,
        title,
        event_or_initiative_name: eventName || null,
        description: row["Why It Fits Crowdsource Choir Anthem Experience"]?.trim() || null,
        status: "new",
        target_contact_role_hint: row["Likely Buyer / Owner"]?.trim() || null,
        import_metadata: { ...row, sourceFile: "Conferences CRM data.csv", importedAt },
      })
      .select()
      .single();
    if (oppError) {
      console.error(`  ! Failed to create opportunity for "${name}": ${oppError.message}`);
      continue;
    }
    opportunitiesCreated += 1;

    const whyItFits = row["Why It Fits Crowdsource Choir Anthem Experience"]?.trim();
    if (whyItFits && sourceUrl) {
      await createImportedFinding(db, {
        pipelineRunId: pipelineRun.id,
        organizationId: organization.id,
        opportunityId: opportunity.id,
        url: sourceUrl,
        claimType: "program_fit_signal",
        claimText: whyItFits,
      });
    }
    const attendanceFit = row["Attendance Fit (300-5000)"]?.trim();
    if (attendanceFit && sourceUrl) {
      await createImportedFinding(db, {
        pipelineRunId: pipelineRun.id,
        organizationId: organization.id,
        opportunityId: opportunity.id,
        url: sourceUrl,
        claimType: "audience_size",
        claimText: `Attendance fit assessed as "${attendanceFit}" against a 300-5000 target range (unverified — from source list, not yet confirmed).`,
        claimValue: { attendanceFit },
      });
    }
  }

  console.log("\nDone.");
  console.log(`Organizations created: ${organizationsCreated}, matched existing: ${organizationsMatched}`);
  console.log(`Opportunities created: ${opportunitiesCreated}, skipped as duplicate: ${opportunitiesSkippedDuplicate}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
