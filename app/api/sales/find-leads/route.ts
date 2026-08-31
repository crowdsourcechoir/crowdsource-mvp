import { NextResponse } from "next/server";
import { executeFindLeads } from "@/lib/sales/find-leads-run";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await executeFindLeads({
      action: body?.action,
      intent: typeof body?.intent === "string" ? body.intent : undefined,
      organizationId: typeof body?.organizationId === "string" ? body.organizationId : undefined,
      organizationName: typeof body?.organizationName === "string" ? body.organizationName : undefined,
      roleHint: typeof body?.roleHint === "string" ? body.roleHint : undefined,
      count: typeof body?.count === "number" ? body.count : undefined,
      focus: typeof body?.focus === "string" ? body.focus : undefined,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Find leads failed") }, { status: 400 });
  }
}
