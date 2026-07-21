import { NextResponse } from "next/server";
import { createOrganization, listOrganizations } from "@/lib/sales/db/organizations";
import { listOrganizationTypes } from "@/lib/sales/db/lookups";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Database not configured." }, { status: 503 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const [organizations, organizationTypes] = await Promise.all([
      listOrganizations({ search, limit: 500 }),
      listOrganizationTypes(),
    ]);
    return NextResponse.json({ organizations, organizationTypes }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Database not configured." }, { status: 503 });
  }
  try {
    const body = await request.json();
    if (!body?.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const organization = await createOrganization({
      name: body.name,
      websiteUrl: body.websiteUrl ?? null,
      locationCity: body.locationCity ?? null,
      locationRegion: body.locationRegion ?? null,
      source: "manual",
    });
    return NextResponse.json({ organization });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
