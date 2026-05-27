import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
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

async function fallbackLogo(): Promise<NextResponse> {
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  const buffer = await readFile(logoPath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const event = await getEventBySlugServer(params.slug);
  const hero = event?.heroImage?.trim() ?? "";

  if (hero.startsWith("http://") || hero.startsWith("https://")) {
    return NextResponse.redirect(hero);
  }

  if (hero.startsWith("data:image/")) {
    const parsed = parseDataImage(hero);
    if (parsed) {
      return new NextResponse(parsed.buffer, {
        headers: {
          "Content-Type": parsed.mime,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  }

  return fallbackLogo();
}
