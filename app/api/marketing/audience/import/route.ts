import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { importMailchimpRows, parseMailchimpCsv } from "@/lib/marketing/ingest/mailchimp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withMarketingAuth(async () => {
    const contentType = request.headers.get("content-type") ?? "";
    let csv = "";
    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as { csv?: string; rows?: unknown } | null;
      if (body?.csv && typeof body.csv === "string") csv = body.csv;
      else if (Array.isArray(body?.rows)) {
        const result = await importMailchimpRows(
          body.rows.map((row) => {
            const record = (row ?? {}) as Record<string, unknown>;
            return {
              email: String(record.email ?? ""),
              displayName: typeof record.displayName === "string" ? record.displayName : null,
              city: typeof record.city === "string" ? record.city : null,
              status: typeof record.status === "string" ? record.status : "subscribed",
              tags: Array.isArray(record.tags)
                ? record.tags.map(String)
                : typeof record.tags === "string"
                  ? record.tags
                  : null,
              mailchimpId: typeof record.mailchimpId === "string" ? record.mailchimpId : null,
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
  });
}
