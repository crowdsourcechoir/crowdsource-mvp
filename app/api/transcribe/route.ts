import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";

export const maxDuration = 60;

function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
  return Buffer.from(base64, "base64");
}

/** Derive file extension and mime type from data URL for Whisper (supports mp4, webm, etc.). */
function getFileInfo(dataUrl: string): { filename: string; type: string } {
  const match = dataUrl.match(/^data:(video|audio)\/([^;]+);/);
  const mime = match ? `${match[1]}/${match[2]}` : "audio/webm";
  const ext = mime.includes("mp4") ? "mp4" : "webm";
  return { filename: `audio.${ext}`, type: mime };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is not set. For local dev add it to .env.local; for production add it in Vercel → Settings → Environment Variables.",
      },
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
    const { filename, type } = getFileInfo(dataUrl);
    const openai = new OpenAI({ apiKey });
    const file = await toFile(buffer, filename, { type });

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
