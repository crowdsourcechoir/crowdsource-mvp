import { NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

export type LyricPromptOption = {
  detailedStylePrompt: string;
  alternativeStylePrompt: string;
  genreBlueprint: string;
  /** Lyric ideas, themes, or suggested lines drawn from the transcripts (so the song reflects crowdsourced content). */
  lyricIdeas: string;
};

export type TranscriptOutput = {
  section1: { prompts: LyricPromptOption[] };
  section2: { keyPhrases: string[] };
};

const SYSTEM_PROMPT = `You are a music producer and lyricist. Given audience voice/video transcripts from an event, you produce two outputs as JSON only (no other text).

SECTION 1 — Three Lyric Prompts (for Suno or similar song-creation tools)
Generate exactly 3 different song directions. Each option must have FOUR fields:

1. "detailedStylePrompt": One paragraph describing style for AI music generation. Include: genre, BPM range, tempo feel, key instruments, vocal style (lead + backing if relevant), structure (e.g. big sing-along chorus), vibe/mood, mix character. Add what to avoid (e.g. "avoid trap hats", "avoid heavy autotune") when helpful. Example style: "pop, dance-pop anthem, 118–122 BPM upbeat party tempo, bright piano stabs + funky rhythm guitar + punchy bass + glossy synth leads, four-on-the-floor drums with claps, female lead vocal with group chant backing vocals, big sing-along chorus, celebratory birthday vibe, crisp modern mix, avoid trap hats, avoid heavy autotune"

2. "alternativeStylePrompt": One short line, same idea but condensed. Example: "upbeat dance-pop, party anthem, energetic female vocal, big catchy chorus, live party band feel with synth accents"

3. "genreBlueprint": Exactly 2 sentences describing how this genre typically works: structure, rhyme scheme, line length, what makes it work for the theme. Example: "Dance-pop birthday anthems typically follow a verse–pre-chorus–big singalong chorus structure, with rhythmic, conversational verses building into an explosive, repetitive hook. Rhymes are simple and punchy (AABB or ABAB), keeping lines tight and chant-ready so a crowd can easily join in."

4. "lyricIdeas": Concrete lyric ideas drawn FROM THE TRANSCRIPTS so the song is not generic. Include: specific themes, suggested hook lines, images, or emotions that came from the submissions. Use direct references to what people said (e.g. "a line about X that someone mentioned", "the recurring wish for Y"). Each of the 3 options should have DIFFERENT lyric angles from the same transcripts (e.g. option 1: hope and community, option 2: specific memories people shared, option 3: wishes for the future). Format as 3–6 short bullet points or 2–4 sentences. This is critical: without lyric ideas from the transcripts, the song would miss the point of crowdsourcing.

Base the 3 options on the themes, emotions, and content in the transcripts so they are relevant to the actual responses.

SECTION 2 — Key Phrases
Extract a list of exact, verbatim phrases from the transcripts. Do not paraphrase or interpret. Pick phrases that are striking, memorable, or useful as creative source material. Return as an array of strings, one phrase per element. Each string must be a direct quote from the transcripts.

Respond with ONLY a single JSON object in this exact shape (no markdown, no code fence):
{
  "section1": {
    "prompts": [
      { "detailedStylePrompt": "...", "alternativeStylePrompt": "...", "genreBlueprint": "...", "lyricIdeas": "..." },
      { "detailedStylePrompt": "...", "alternativeStylePrompt": "...", "genreBlueprint": "...", "lyricIdeas": "..." },
      { "detailedStylePrompt": "...", "alternativeStylePrompt": "...", "genreBlueprint": "...", "lyricIdeas": "..." }
    ]
  },
  "section2": {
    "keyPhrases": ["exact phrase 1", "exact phrase 2", ...]
  }
}`;

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

    const userContent = scope?.trim()
      ? `Additional context or focus: ${scope.trim()}\n\nUse the transcripts below for Section 1 and Section 2.\n\nTranscripts:\n${combined}`
      : `Transcripts:\n${combined}`;

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      max_tokens: 2048,
    });

    const raw =
      completion.choices[0]?.message?.content?.trim() || "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    let parsed: TranscriptOutput;
    try {
      parsed = JSON.parse(cleaned) as TranscriptOutput;
    } catch {
      console.error("Summarize: invalid JSON", raw);
      return NextResponse.json(
        { error: "AI returned invalid format. Try again." },
        { status: 500 }
      );
    }

    if (!parsed.section1?.prompts || !Array.isArray(parsed.section1.prompts)) {
      parsed.section1 = { prompts: [] };
    } else {
      parsed.section1.prompts = parsed.section1.prompts.map((p) => ({
        detailedStylePrompt: p.detailedStylePrompt ?? "",
        alternativeStylePrompt: p.alternativeStylePrompt ?? "",
        genreBlueprint: p.genreBlueprint ?? "",
        lyricIdeas: typeof p.lyricIdeas === "string" ? p.lyricIdeas : "",
      }));
    }
    if (!parsed.section2?.keyPhrases || !Array.isArray(parsed.section2.keyPhrases)) {
      parsed.section2 = { keyPhrases: [] };
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Summarize error:", err);
    const message = err instanceof Error ? err.message : "Summary failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
