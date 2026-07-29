#!/usr/bin/env node
/**
 * One-off: apply AORN / NACADA / US Mayors bounced-email repairs against Supabase.
 * Usage: node scripts/sales/repair-bounced-emails.mjs
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (via env or .env.local).
 */
import { loadEnvLocal, getSupabaseAdmin } from "./_shared.mjs";

loadEnvLocal();

const REPAIRS = [
  {
    organizationId: "1e27b156-a0a1-45b1-b81d-54f3bee1b65b",
    name: "AORN",
    invalidate: [
      "jdon-baker@aorn.org",
      "pgraling@aorn.org",
      "cmunro@aorn.org",
      "jspear@aorn.org",
      "cspry@aorn.org",
      "dwagner@aorn.org",
    ],
    upsert: [
      {
        full_name: "Cate David",
        role_title: "Account Executive, AORN Expo Sales (MCI)",
        email: "cate.david@wearemci.com",
        outreach_persona: "conference_planner",
        source_url: "https://wearemci.us/files/AORN_2025_Prospectus.pdf",
      },
      {
        full_name: "AORN Expo Sales",
        role_title: "Expo / Exhibitor Sales Desk (MCI)",
        email: "aornexhibsales@wearemci.com",
        outreach_persona: "conference_planner",
        source_url: "https://go.networkmediapartners.com/aorn-prospectus",
      },
      {
        full_name: "AORN Partnerships",
        role_title: "Vendor Partnerships",
        email: "partner@aorn.org",
        outreach_persona: "events_director",
        source_url: "https://wearemci.us/files/AORN_2025_Prospectus.pdf",
      },
    ],
    preferredEmail: "cate.david@wearemci.com",
  },
  {
    organizationId: "99776134-9ed3-40cd-84f4-9c341fb9cac8",
    name: "NACADA",
    invalidate: ["elisa.shaffer@nacada.ksu.edu"],
    upsert: [
      {
        full_name: "Elisa Shaffer",
        role_title: "Senior Instructional Designer, Executive Office",
        email: "elshaffer@ksu.edu",
        outreach_persona: "program_manager",
        source_url: "https://nacada.ksu.edu/Programs-Services/eTutorials",
      },
      {
        full_name: "NACADA Executive Office",
        role_title: "Executive Office",
        email: "nacada@ksu.edu",
        outreach_persona: "executive_director",
        source_url: "https://nacada.ksu.edu/About-Us/Frequently-Asked-Questions.aspx",
      },
    ],
    preferredEmail: "elshaffer@ksu.edu",
    renameElisa: true,
  },
  {
    organizationId: "09fbc5d4-0608-440a-ac42-f5624786e69c",
    name: "U.S. Conference of Mayors",
    invalidate: ["jocelynbogen@usmayors.org"],
    upsert: [
      {
        full_name: "Geri Powell",
        role_title: "Managing Director, Mayors Business Council",
        email: "gpowell@usmayors.org",
        outreach_persona: "executive_director",
        source_url: "https://www.usmayors.org/wp-content/uploads/2025/09/2025-2026-brochure-sep-3.pdf",
      },
      {
        full_name: "Judy Reid",
        role_title: "Membership Services Manager, Mayors Business Council",
        email: "jreid@usmayors.org",
        outreach_persona: "program_manager",
        source_url: "https://www.usmayors.org/wp-content/uploads/2025/09/2025-2026-brochure-sep-3.pdf",
      },
      {
        full_name: "Jocelyn Bogen",
        role_title: "Program Director",
        email: "jbogen@usmayors.org",
        outreach_persona: "program_manager",
        source_url: "https://www.usmayors.org/wp-content/uploads/2020/02/2019PlayBallReport.MEC_.pdf",
      },
    ],
    preferredEmail: "gpowell@usmayors.org",
  },
];

async function main() {
  const db = getSupabaseAdmin();
  for (const repair of REPAIRS) {
    console.log(`\n=== ${repair.name} ===`);
    for (const email of repair.invalidate) {
      const { data, error } = await db
        .from("contacts")
        .update({
          email_verification_status: "invalid",
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", repair.organizationId)
        .eq("normalized_email", email.toLowerCase())
        .select("id, email");
      if (error) throw error;
      console.log(`  invalidate ${email}: ${data?.length ?? 0} row(s)`);
    }

    if (repair.renameElisa) {
      const { error } = await db
        .from("contacts")
        .update({
          email: "elshaffer@ksu.edu",
          normalized_email: "elshaffer@ksu.edu",
          role_title: "Senior Instructional Designer, Executive Office",
          email_verification_status: "verified_deliverable",
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", repair.organizationId)
        .ilike("full_name", "Elisa Shaffer");
      if (error) throw error;
      console.log("  patched Elisa Shaffer → elshaffer@ksu.edu");
    }

    for (const row of repair.upsert) {
      const { data: existing } = await db
        .from("contacts")
        .select("id")
        .eq("organization_id", repair.organizationId)
        .eq("normalized_email", row.email.toLowerCase())
        .maybeSingle();
      if (existing?.id) {
        const { error } = await db
          .from("contacts")
          .update({
            full_name: row.full_name,
            role_title: row.role_title,
            email_verification_status: "verified_deliverable",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
        console.log(`  updated ${row.email}`);
      } else {
        const { error } = await db.from("contacts").insert({
          organization_id: repair.organizationId,
          full_name: row.full_name,
          role_title: row.role_title,
          email: row.email,
          normalized_email: row.email.toLowerCase(),
          email_verification_status: "verified_deliverable",
          source: "manual",
          outreach_persona: row.outreach_persona,
          import_metadata: {
            verifiedRepair: {
              repairedAt: new Date().toISOString(),
              sourceUrl: row.source_url,
            },
          },
        });
        if (error) throw error;
        console.log(`  inserted ${row.email}`);
      }
    }

    const { data: preferred } = await db
      .from("contacts")
      .select("id")
      .eq("organization_id", repair.organizationId)
      .eq("normalized_email", repair.preferredEmail.toLowerCase())
      .maybeSingle();
    if (preferred?.id) {
      const { data: opps } = await db.from("opportunities").select("id").eq("organization_id", repair.organizationId);
      const oppIds = (opps ?? []).map((o) => o.id);
      if (oppIds.length) {
        const { data: drafts, error } = await db
          .from("outreach_drafts")
          .update({ contact_id: preferred.id, updated_at: new Date().toISOString() })
          .in("opportunity_id", oppIds)
          .select("id");
        if (error) throw error;
        console.log(`  retargeted ${drafts?.length ?? 0} draft(s) → ${repair.preferredEmail}`);
      }
    }
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
