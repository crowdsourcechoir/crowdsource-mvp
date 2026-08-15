import { NextResponse } from "next/server";
import { enrichContactEmail, activeEnrichmentProvider } from "@/lib/sales/enrichment";
import { getEnrichmentConfigStatus } from "@/lib/sales/enrichment/config-status";
import { activeSearchProvider, runSearch } from "@/lib/sales/discovery/search";

export const dynamic = "force-dynamic";

/**
 * One-shot contact email finder for sales research.
 * Uses Hunter (preferred) / Apollo enrichment + optional Tavily/Serper search context.
 *
 * GET ?firstName=&lastName=&domain=seahawks.com
 * Optional: &search=1 to also run a web search for public contact clues.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const firstName = (searchParams.get("firstName") ?? "").trim();
    const lastName = (searchParams.get("lastName") ?? "").trim();
    const domain = (searchParams.get("domain") ?? "").trim().toLowerCase().replace(/^@/, "");
    const withSearch = searchParams.get("search") === "1";

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

    let search: { provider: string | null; results: { title: string; url: string; snippet: string }[]; error: string | null } | null =
      null;
    if (withSearch) {
      const searchProvider = activeSearchProvider();
      if (!searchProvider) {
        search = { provider: null, results: [], error: "No search provider configured" };
      } else {
        const q = `${firstName} ${lastName} ${domain} email OR contact OR "${firstName}.${lastName}"`;
        const result = await runSearch(q);
        search = result
          ? { provider: result.provider, results: result.results.slice(0, 5), error: result.error }
          : { provider: searchProvider, results: [], error: "Search failed" };
      }
    }

    return NextResponse.json(
      {
        query: { firstName, lastName, domain },
        config,
        enrichment,
        search,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
