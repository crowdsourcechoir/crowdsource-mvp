import { NextResponse } from "next/server";
import { receiveResendWebhook } from "@/lib/marketing/send/apply-webhook";
import { MarketingDbError } from "@/lib/marketing/db/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const raw = await request.text();
  try {
    const result = await receiveResendWebhook(raw, {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    if (err instanceof MarketingDbError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Webhook failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
