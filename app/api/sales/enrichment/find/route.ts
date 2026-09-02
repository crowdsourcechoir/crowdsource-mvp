import { NextResponse } from "next/server";
import { enrichContactEmail, activeEnrichmentProvider } from "@/lib/sales/enrichment";
import { getEnrichmentConfigStatus } from "@/lib/sales/enrichment/config-status";

export const dynamic = "force-dynamic";

/**
 * One-shot contact email finder for sales research. Hunter Email Finder only.
 *
 * GET ?firstName=&lastName=&domain=seahawks.com
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const firstName = (searchParams.get("firstName") ?? "").trim();
    const lastName = (searchParams.get("lastName") ?? "").trim();
    const domain = (searchParams.get("domain") ?? "").trim().toLowerCase().replace(/^@/, "");

    if (!firstName || !lastName || !domain) {
      return NextResponse.json(
        { error: "firstName, lastName, and domain are required" },
        { status: 400 }
      );
    }

    const config = getEnrichmentConfigStatus();
    const provider = activeEnrichmentProvider();
    const enrichment = provider
      ? await enrichContactEmail({ firstName, lastName, domain })
      : {
          provider: null,
          status: "error" as const,
          email: null,
          error: config.message ?? "No enrichment provider configured",
        };

    return NextResponse.json(
      {
        query: { firstName, lastName, domain },
        config,
        enrichment,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
