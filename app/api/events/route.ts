import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  localEventsGetAll,
  localEventsGetBySlug,
  localEventsCreate,
} from "@/lib/local-events-store";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";
const OPTIONAL_EVENT_COLUMNS = new Set([
  "hero_image_mode",
  "landing_headline",
  "landing_copy",
  "cta_text",
  "allow_audio_video_prompt",
]);

type SupabaseMutationError = {
  code?: string;
  message?: string;
};

function missingOptionalColumn(error: SupabaseMutationError | null): string | null {
  if (!error?.message) return null;
  const match = error.message.match(/'([^']+)' column/);
  const column = match?.[1];
  return column && OPTIONAL_EVENT_COLUMNS.has(column) ? column : null;
}

function withoutColumn(row: Record<string, unknown>, column: string): Record<string, unknown> {
  const next = { ...row };
  delete next[column];
  return next;
}

async function insertEventWithCompatibility(row: Record<string, unknown>) {
  let current = row;
  for (let attempt = 0; attempt <= OPTIONAL_EVENT_COLUMNS.size; attempt++) {
    const result = await supabaseAdmin!.from("events").insert(current).select().single();
    if (!result.error) return result;
    const missing = missingOptionalColumn(result.error);
    if (!missing || !(missing in current)) return result;
    current = withoutColumn(current, missing);
  }
  return supabaseAdmin!.from("events").insert(current).select().single();
}

export async function GET(request: Request) {
  if (USE_LOCAL_EVENTS) {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    if (slug) {
      const event = localEventsGetBySlug(slug);
      if (!event) return NextResponse.json(null, { status: 404 });
      return NextResponse.json(rowToEvent(event));
    }
    const data = localEventsGetAll();
    return NextResponse.json(data.map(rowToEvent));
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or set USE_LOCAL_EVENTS=true in .env.local for local testing." },
      { status: 503 }
    );
  }
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  try {
    if (slug) {
      const { data, error } = await supabaseAdmin
        .from("events")
        .select("*")
        .eq("slug", slug)
        .single();
      if (error) {
        if (error.code === "PGRST116") return NextResponse.json(null, { status: 404 });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(rowToEvent(data));
    }

    /* List: use * so older production DBs (missing newer columns) still return rows. Strip agent_brief here — it can be large. */
    const { data, error } = await supabaseAdmin.from("events").select("*").order("date", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const list = (data ?? []).map((row) => {
      const e = rowToEvent(row);
      return { ...e, agentBrief: null };
    });
    return NextResponse.json(list);
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (USE_LOCAL_EVENTS) {
    try {
      const body = await request.json();
      const row = eventToRow(body);
      const created = localEventsCreate({
        slug: row.slug as string,
        title: row.title as string,
        description: row.description as string,
        date: row.date as string,
        time: row.time as string,
        venue: row.venue as string,
        address: row.address as string,
        prompt: row.prompt as string,
        hero_image: row.hero_image as string,
        hero_image_mode: (row.hero_image_mode as "bw" | "color") ?? "bw",
        landing_headline:
          (row.landing_headline as string) ??
          "We're crowdsourcing a song for this event. Want to help create it?",
        landing_copy: (row.landing_copy as string) ?? "",
        cta_text: (row.cta_text as string) ?? "Let's make an anthem",
        allow_audio_video_prompt: (row.allow_audio_video_prompt as boolean) ?? true,
        agent_theme_id: row.agent_theme_id as string | null,
        agent_brief: row.agent_brief,
      });
      return NextResponse.json(rowToEvent(created));
    } catch (err) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or set USE_LOCAL_EVENTS=true in .env.local for local testing." },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const row = eventToRow(body);
    const { data, error } = await insertEventWithCompatibility(row);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(rowToEvent(data));
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function eventToRow(e: Record<string, unknown>) {
  return {
    slug: e.slug ?? "",
    title: e.title ?? "",
    description: e.description ?? "",
    date: e.date ?? "",
    time: e.time ?? "",
    venue: e.venue ?? "",
    address: e.address ?? "",
    prompt: e.prompt ?? "",
    hero_image: e.heroImage ?? "",
    hero_image_mode: (e as { heroImageMode?: "bw" | "color" }).heroImageMode ?? "bw",
    landing_headline:
      (e as { landingHeadline?: string }).landingHeadline ??
      "We're crowdsourcing a song for this event. Want to help create it?",
    landing_copy: (e as { landingCopy?: string }).landingCopy ?? "",
    cta_text: (e as { ctaText?: string }).ctaText ?? "Let's make an anthem",
    allow_audio_video_prompt: (e as { allowAudioVideoPrompt?: boolean }).allowAudioVideoPrompt ?? true,
    agent_theme_id: (e as { agentThemeId?: string | null }).agentThemeId ?? null,
    agent_brief: (e as { agentBrief?: unknown }).agentBrief ?? null,
  };
}

function rowToEvent(row: Record<string, unknown>) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    date: row.date,
    time: row.time,
    venue: row.venue,
    address: row.address,
    prompt: row.prompt,
    heroImage: row.hero_image ?? "",
    heroImageMode: row.hero_image_mode === "color" ? "color" : "bw",
    landingHeadline:
      (row.landing_headline as string) ??
      "We're crowdsourcing a song for this event. Want to help create it?",
    landingCopy: (row.landing_copy as string) ?? "",
    ctaText: (row.cta_text as string) ?? "Let's make an anthem",
    allowAudioVideoPrompt: (row.allow_audio_video_prompt as boolean) ?? true,
    agentThemeId: row.agent_theme_id ?? null,
    agentBrief: row.agent_brief ?? null,
  };
}
