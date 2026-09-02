import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { getOrganization } from "@/lib/sales/db/organizations";
import { addOrganizationQuick } from "@/lib/sales/seed/add-manual";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Add a contact to this org. Hunter finds email if missing. Queues when an email is present. */
export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Database not configured." }, { status: 503 });
  }

  try {
    const { orgId } = await params;
    const organization = await getOrganization(orgId);
    if (!organization) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await request.json();
    const result = await addOrganizationQuick({
      name: organization.name,
      websiteUrl: organization.websiteUrl,
      salesInitiative:
        organization.importMetadata && typeof organization.importMetadata.salesInitiative === "string"
          ? organization.importMetadata.salesInitiative
          : null,
      contactFullName: typeof body?.fullName === "string" ? body.fullName : null,
      contactEmail: typeof body?.email === "string" ? body.email : null,
      contactRoleTitle: typeof body?.roleTitle === "string" ? body.roleTitle : null,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Could not add contact") }, { status: 400 });
  }
}
