import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { canonicalEventSlug } from "@/lib/event-slug-aliases";
import { getEventBySlugServer } from "@/lib/events-server";

export const dynamic = "force-dynamic";

function parseDataImage(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  try {
    return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
  } catch {
    return null;
  }
}

function bufferToBody(buffer: Buffer, mime: string): Blob {
  return new Blob([new Uint8Array(buffer)], { type: mime });
}

async function fallbackLogo(): Promise<NextResponse> {
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  const buffer = await readFile(logoPath);
  return new NextResponse(bufferToBody(buffer, "image/png"), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const event = await getEventBySlugServer(canonicalEventSlug(params.slug));
  const hero = event?.heroImage?.trim() ?? "";

  if (hero.startsWith("http://") || hero.startsWith("https://")) {
    return NextResponse.redirect(hero);
  }

  if (hero.startsWith("data:image/")) {
    const parsed = parseDataImage(hero);
    if (parsed) {
      return new NextResponse(bufferToBody(parsed.buffer, parsed.mime), {
        headers: {
          "Content-Type": parsed.mime,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  }

  return fallbackLogo();
}
