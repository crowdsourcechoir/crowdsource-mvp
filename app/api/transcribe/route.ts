import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";

export const maxDuration = 60;

function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
  return Buffer.from(base64, "base64");
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set. Add it to .env.local to use transcription." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { audioDataUrl, videoDataUrl } = body as { audioDataUrl?: string; videoDataUrl?: string };
    const dataUrl = audioDataUrl || videoDataUrl;
    if (!dataUrl || typeof dataUrl !== "string") {
      return NextResponse.json({ error: "Missing audioDataUrl or videoDataUrl" }, { status: 400 });
    }

    const buffer = dataUrlToBuffer(dataUrl);
    const openai = new OpenAI({ apiKey });
    const file = await toFile(buffer, "audio.webm", { type: "audio/webm" });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "text",
    });

    const text =
      typeof transcription === "string"
        ? transcription
        : (transcription as { text?: string }).text ?? "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("Transcribe error:", err);
    const message = err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
