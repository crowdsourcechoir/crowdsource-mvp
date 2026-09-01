import { NextResponse } from "next/server";
import { listOrganizations } from "@/lib/sales/db/organizations";
import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import { SALES_INITIATIVES, SEATTLE_SPORTS_PRIORITY, readSalesInitiative } from "@/lib/sales/initiatives";

export const dynamic = "force-dynamic";

/**
 * Sports vs conferences initiative overview — how to stay organized, plus Seattle sports CRM gaps.
 */
export async function GET() {
  try {
    const orgs = await listOrganizations({ limit: 500 });
    const byInitiative: Record<string, number> = { untagged: 0 };
    for (const key of Object.keys(SALES_INITIATIVES)) byInitiative[key] = 0;
    for (const o of orgs) {
      const key = readSalesInitiative(o.importMetadata);
      if (key) byInitiative[key] += 1;
      else byInitiative.untagged += 1;
    }

    const priority = [];
    for (const row of SEATTLE_SPORTS_PRIORITY) {
      const org = orgs.find((o) => o.name.toLowerCase() === row.name.toLowerCase());
      if (!org) {
        priority.push({ ...row, inCrm: false, contactCount: 0, emailCount: 0 });
        continue;
      }
      const contacts = await listContactsForOrganization(org.id);
      const emailCount = contacts.filter((c) => Boolean(c.email?.includes("@"))).length;
      priority.push({
        ...row,
        inCrm: true,
        organizationId: org.id,
        contactCount: contacts.length,
        emailCount,
        salesInitiative: readSalesInitiative(org.importMetadata),
      });
    }

    return NextResponse.json(
      {
        initiatives: SALES_INITIATIVES,
        howToStayOrganized: [
          "Tag sports orgs with import_metadata.salesInitiative = sports_fan_culture (apply-seahawks-voice does this).",
          "Tag conference CSV orgs with conferences_associations when re-importing or via org edit.",
          "Queue/filter mentally: sports = fan_engagement_initiative + sports_team/university athletics; conferences = annual_conference.",
          "Enrich emails only inside the sports initiative priority list before enqueue — don't mix conference digests with sports.",
          "Tyler (tylerc@seahawks.com) stays hard-blocked regardless of initiative.",
        ],
        counts: byInitiative,
        seattleSportsPriority: priority,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
