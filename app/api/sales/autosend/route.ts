import { NextResponse } from "next/server";
import { readAutoSendState } from "@/lib/sales/autosend/store";
import { buildAutoSendQueueView } from "@/lib/sales/autosend/view";
import { refreshAutoSendPlan, setAutoSendEnabled } from "@/lib/sales/autosend/tick";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REFRESH_AFTER_MS = 2 * 60 * 1000;

export async function GET() {
  try {
    const current = await readAutoSendState();
    const age = current.state.updatedAt ? Date.now() - Date.parse(current.state.updatedAt) : Number.POSITIVE_INFINITY;
    const loaded = current.error || age > REFRESH_AFTER_MS ? await refreshAutoSendPlan() : current;
    const view = await buildAutoSendQueueView(loaded.state, loaded.error);
    return NextResponse.json(view);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be true or false." }, { status: 400 });
    }
    const { state, error } = await setAutoSendEnabled(body.enabled);
    if (error) return NextResponse.json({ error }, { status: 503 });
    const view = await buildAutoSendQueueView(state, null);
    return NextResponse.json(view);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
