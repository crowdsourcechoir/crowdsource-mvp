import { NextResponse } from "next/server";
import {
  getResonanceSignalState,
  setResonanceSignalField,
} from "@/lib/resonance-signal-store";

export async function GET() {
  try {
    const state = await getResonanceSignalState();
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const fieldId = typeof body.fieldId === "string" ? body.fieldId : "";
    const state = await setResonanceSignalField(fieldId);
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 400 }
    );
  }
}
