import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { countExistingEmails } from "@/lib/marketing/db/people";
import { importMailchimpRows, parseMailchimpCsv } from "@/lib/marketing/ingest/mailchimp";
import type { MailchimpImportRow } from "@/lib/marketing/ingest/mailchimp-csv";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const IMPORT_LIMIT = 40;
const MATCH_LIMIT = 500;

function asRow(row: unknown): MailchimpImportRow {
  const record = (row ?? {}) as Record<string, unknown>;
  return {
    email: String(record.email ?? ""),
    displayName: typeof record.displayName === "string" ? record.displayName : null,
    city: typeof record.city === "string" ? record.city : null,
    region: typeof record.region === "string" ? record.region : null,
    country: typeof record.country === "string" ? record.country : null,
    status: typeof record.status === "string" ? record.status : "subscribed",
    tags: Array.isArray(record.tags) ? record.tags.map(String) : typeof record.tags === "string" ? record.tags : null,
    mailchimpId: typeof record.mailchimpId === "string" ? record.mailchimpId : null,
    confirmedAt: typeof record.confirmedAt === "string" ? record.confirmedAt : null,
  };
}

export async function POST(request: Request) {
  return withMarketingAuth(async () => {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const csv = await request.text();
      const rows = parseMailchimpCsv(csv);
      if (rows.length === 0) {
        return NextResponse.json({ error: "No rows found. Need a header with an Email column." }, { status: 400 });
      }
      if (rows.length > IMPORT_LIMIT) {
        return NextResponse.json(
          { error: `Send at most ${IMPORT_LIMIT} rows at a time. This file has ${rows.length}.` },
          { status: 400 }
        );
      }
      const result = await importMailchimpRows(rows);
      return NextResponse.json({ ...result, parsed: rows.length });
    }

    const body = (await request.json().catch(() => null)) as {
      csv?: string;
      rows?: unknown;
      dryRun?: boolean;
      emails?: unknown;
    } | null;

    if (body?.dryRun) {
      const emails = Array.isArray(body.emails) ? body.emails.filter((email): email is string => typeof email === "string") : [];
      if (emails.length > MATCH_LIMIT) {
        return NextResponse.json({ error: `Check at most ${MATCH_LIMIT} emails at a time.` }, { status: 400 });
      }
      const existing = await countExistingEmails(emails);
      return NextResponse.json({ existing });
    }

    if (body?.csv && typeof body.csv === "string") {
      const rows = parseMailchimpCsv(body.csv);
      if (rows.length === 0) {
        return NextResponse.json({ error: "No rows found. Need a header with an Email column." }, { status: 400 });
      }
      if (rows.length > IMPORT_LIMIT) {
        return NextResponse.json(
          { error: `Send at most ${IMPORT_LIMIT} rows at a time. This file has ${rows.length}.` },
          { status: 400 }
        );
      }
      const result = await importMailchimpRows(rows);
      return NextResponse.json({ ...result, parsed: rows.length });
    }

    if (Array.isArray(body?.rows)) {
      if (body.rows.length > IMPORT_LIMIT) {
        return NextResponse.json({ error: `Send at most ${IMPORT_LIMIT} rows at a time.` }, { status: 400 });
      }
      const result = await importMailchimpRows(body.rows.map(asRow));
      return NextResponse.json({ ...result, parsed: body.rows.length });
    }

    return NextResponse.json({ error: "CSV body required" }, { status: 400 });
  });
}
