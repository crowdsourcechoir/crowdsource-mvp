import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { addOrganizationQuick } from "@/lib/sales/seed/add-manual";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Add an organization (and optional contact) from the queue — Hunter finds email if missing. */
export async function POST(request: Request) {
  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Database not configured." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const result = await addOrganizationQuick({
      name: typeof body?.name === "string" ? body.name : "",
      websiteUrl: typeof body?.websiteUrl === "string" ? body.websiteUrl : null,
      salesInitiative: typeof body?.salesInitiative === "string" ? body.salesInitiative : null,
      contactFullName: typeof body?.contactFullName === "string" ? body.contactFullName : null,
      contactEmail: typeof body?.contactEmail === "string" ? body.contactEmail : null,
      contactRoleTitle: typeof body?.contactRoleTitle === "string" ? body.contactRoleTitle : null,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Could not add organization") }, { status: 500 });
  }
}
