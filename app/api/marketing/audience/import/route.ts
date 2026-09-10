import { NextResponse } from "next/server";
import { importMailchimpRows, parseMailchimpCsv } from "@/lib/marketing/ingest/mailchimp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let csv = "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { csv?: string; rows?: unknown } | null;
    if (body?.csv && typeof body.csv === "string") csv = body.csv;
    else if (Array.isArray(body?.rows)) {
      const result = await importMailchimpRows(
        body.rows.map((r) => {
          const row = (r ?? {}) as Record<string, unknown>;
          return {
            email: String(row.email ?? ""),
            displayName: typeof row.displayName === "string" ? row.displayName : null,
            city: typeof row.city === "string" ? row.city : null,
            status: typeof row.status === "string" ? row.status : "subscribed",
            tags: Array.isArray(row.tags) ? row.tags.map(String) : typeof row.tags === "string" ? row.tags : null,
            mailchimpId: typeof row.mailchimpId === "string" ? row.mailchimpId : null,
          };
        })
      );
      return NextResponse.json(result);
    }
  } else {
    csv = await request.text();
  }
  if (!csv.trim()) return NextResponse.json({ error: "CSV body required" }, { status: 400 });
  const rows = parseMailchimpCsv(csv);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows found. Need a header with an Email column." }, { status: 400 });
  }
  const result = await importMailchimpRows(rows);
  return NextResponse.json({ ...result, parsed: rows.length });
}
