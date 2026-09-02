import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { searchSalesDatabase } from "@/lib/sales/db/search";
import { SEARCH_MIN_CHARS } from "@/lib/sales/search/query";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(request: Request) {
  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Database not configured." }, { status: 503 });
  }

  try {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    if (q.trim().length < SEARCH_MIN_CHARS) {
      return NextResponse.json({ hits: [], query: q }, { headers: { "Cache-Control": "no-store" } });
    }
    const hits = await searchSalesDatabase(q);
    return NextResponse.json({ hits, query: q }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Search failed") }, { status: 500 });
  }
}
