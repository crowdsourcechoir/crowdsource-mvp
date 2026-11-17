import { NextResponse } from "next/server";
import { getOrganization } from "@/lib/sales/db/organizations";
import { publicErrorMessage } from "@/lib/sales/http-error";
import { queueOrganizationFromPage } from "@/lib/sales/seed/queue-from-page";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Add this organization to the sales queue, even when the contact has no email yet. */
export async function POST(_request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const organization = await getOrganization(orgId);
    if (!organization) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const result = await queueOrganizationFromPage(organization);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Could not add to the queue") }, { status: 400 });
  }
}
