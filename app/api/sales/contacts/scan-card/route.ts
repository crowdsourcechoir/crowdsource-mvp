import { NextResponse } from "next/server";
import { extractBusinessCardFromImage } from "@/lib/sales/card-scan/extract";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** OCR a business-card photo → structured contact fields (does not save). */
export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set — card scan needs vision." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : "";
    if (!imageDataUrl) {
      return NextResponse.json({ error: "imageDataUrl is required." }, { status: 400 });
    }
    const result = await extractBusinessCardFromImage(imageDataUrl);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Could not read the card") }, { status: 500 });
  }
}
