import { NextResponse } from "next/server";
import { recordResonanceHoldSignal } from "@/lib/resonance-signal-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    const fieldId = typeof body.fieldId === "string" ? body.fieldId : "";
    const signalId = typeof body.signalId === "string" ? body.signalId : "";
    const durationMs = Number(body.durationMs);

    if (!deviceId || !fieldId || !signalId || !Number.isFinite(durationMs)) {
      return NextResponse.json({ error: "Invalid resonance hold." }, { status: 400 });
    }

    await recordResonanceHoldSignal({ deviceId, durationMs, fieldId, signalId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
