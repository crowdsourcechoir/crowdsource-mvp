import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { applyCityList } from "@/lib/marketing/db/city-list";
import { countExistingEmails } from "@/lib/marketing/db/people";
import { MarketingDbError } from "@/lib/marketing/db/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CHECK_LIMIT = 500;
const APPLY_LIMIT = 40;

function emailsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((email): email is string => typeof email === "string");
}

export async function POST(request: Request) {
  return withMarketingAuth(async () => {
    const body = (await request.json().catch(() => null)) as { city?: unknown; emails?: unknown; dryRun?: unknown } | null;
    const city = typeof body?.city === "string" ? body.city.trim() : "";
    const emails = emailsOf(body?.emails);
    if (!city || city.length > 40) return NextResponse.json({ error: "Enter a city name." }, { status: 400 });
    if (!emails.length) return NextResponse.json({ error: "That file has no email addresses." }, { status: 400 });

    try {
      if (body?.dryRun) {
        if (emails.length > CHECK_LIMIT) {
          return NextResponse.json({ error: `Check at most ${CHECK_LIMIT} emails at a time.` }, { status: 400 });
        }
        const existing = await countExistingEmails(emails);
        return NextResponse.json({ existing });
      }
      if (emails.length > APPLY_LIMIT) {
        return NextResponse.json({ error: `Save at most ${APPLY_LIMIT} emails at a time.` }, { status: 400 });
      }
      const result = await applyCityList(city, emails);
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof MarketingDbError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
    }
  });
}
