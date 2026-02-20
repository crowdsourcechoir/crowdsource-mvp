import { NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 30;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set. Add it to .env.local to use AI summary." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { transcripts, scope } = body as {
      transcripts: Array<{ name: string | null; text: string }>;
      scope?: string;
    };
    if (!Array.isArray(transcripts) || transcripts.length === 0) {
      return NextResponse.json(
        { error: "Provide a non-empty transcripts array." },
        { status: 400 }
      );
    }

    const parts = transcripts.map(
      (t, i) =>
        `--- Response ${i + 1} (${t.name || "Anonymous"}) ---\n${t.text || "(no transcript)"}`
    );
    const combined = parts.join("\n\n");

    const systemBase =
      "You are a script editor. Given multiple audience responses (voice/video transcripts), produce one concise summary script that aggregates the main themes, quotes, and ideas. Write in clear prose suitable for a host or performer to read. Keep it under 400 words unless the material clearly needs more.";
    const systemWithScope =
      scope?.trim() ? `${systemBase}\n\nAdditional instructions (follow these): ${scope.trim()}` : systemBase;

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemWithScope },
        {
          role: "user",
          content: `Aggregate these audience responses into a single summary script:\n\n${combined}`,
        },
      ],
      max_tokens: 1024,
    });

    const summary =
      completion.choices[0]?.message?.content?.trim() ||
      "No summary generated.";
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("Summarize error:", err);
    const message = err instanceof Error ? err.message : "Summary failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
