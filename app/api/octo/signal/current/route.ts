import { NextResponse } from "next/server";
import { interpretResonanceAsOctoSignal } from "@/data/octoSignalLayer";
import {
  getResonanceSignalState,
  listRecentResonanceHolds,
} from "@/lib/resonance-signal-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const resonanceState = await getResonanceSignalState();
    const holds = await listRecentResonanceHolds(resonanceState.signalId);
    const signal = interpretResonanceAsOctoSignal(resonanceState, holds);
    return NextResponse.json(signal);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
