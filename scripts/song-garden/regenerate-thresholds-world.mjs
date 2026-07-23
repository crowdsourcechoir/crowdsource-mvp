/**
 * Invents a NEW Song Garden world for Thresholds / Populus Seattle from vibe
 * (text→image→10s video) and patches the event. Bypasses the Next route timeout.
 *
 * Usage: node --env-file=.env.local scripts/song-garden/regenerate-thresholds-world.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const EVENT_ID = "9cc14ef0-ca7f-4ffd-b101-2f762af872e6";
const FRAME_COUNT = 4;
const VIDEO_DURATION = 10;
const RUNWAY_API_BASE = "https://api.dev.runwayml.com";
const RUNWAY_VERSION = "2024-11-06";
const BUCKET = process.env.SONG_GARDEN_MEDIA_BUCKET || "song-garden-world-media";
const API_BASE = process.env.LOCAL_API_BASE || "http://localhost:3000";

const VIBE = `Song Garden at Populus Seattle — Thresholds. The Salish Sea, autumn rain, rivers flowing toward the ocean, and forests beginning their return to the soil, meeting Pioneer Square's brick streets, rail history, and creative urban renewal. Populus becomes a threshold between city and wild. Moss-covered stone, drifting leaves, cedar roots, tide pools, and flowing water intertwine with luminous digital ecosystems, generative light, holographic currents, and a glowing mycelial web of seeds planted by the community. Premium cinematic: rainy Pacific Northwest dusk into warm interior light. Moss green, deep teal, weathered cedar, rust, amber, slate blue, soft gold. Living regenerative ecosystem entering a season of transformation.`;

const INTENSITY = [
  "quiet dormant PNW dusk, soft autumn rain mist over moss stone, faint warm interior glow on the horizon, sparse bioluminescent seeds barely lit, calm empty brick and forest pathways",
  "early awakening, tide pools beginning to shimmer, soft gold mycelial threads connecting a few glowing seeds, cedar roots and pioneer brick faintly pulsing with light",
  "living garden emerging, moss forests and digital currents intertwined, amber and deep teal light, mycelial network spreading through rain and city streets, pathways starting to pulse",
  "full bloom regenerative threshold ecosystem, radiant moss greens and soft gold, holographic water currents, dense glowing seed network of community contributions, optimistic cinematic energy",
];

const IMAGE_SUFFIX =
  "Premium cinematic wide environment concept art, tack-sharp focus, high detail, crisp textures, no soft focus, no heavy fog or muddy blur, no people in foreground, no readable text or logos, moss green deep teal weathered cedar rust amber slate blue soft gold bioluminescent color palette.";
const MOTION_SUFFIX =
  "Subtle ambient motion only, slow drifting light, gentle water shimmer, camera locked in place, seamless looping atmosphere, keep the scene sharp and clear, no soft focus, no heavy haze or blur, no people walking into frame, no text or logos.";

function apiKey() {
  const key = process.env.RUNWAYML_API_SECRET?.trim();
  if (!key) throw new Error("RUNWAYML_API_SECRET missing");
  return key;
}

async function runwayFetch(path, init = {}) {
  const res = await fetch(`${RUNWAY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "X-Runway-Version": RUNWAY_VERSION,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    console.error("Runway error", res.status, text);
    throw new Error(data?.error || data?.message || text || `HTTP ${res.status}`);
  }
  return data;
}

async function waitForTask(taskId) {
  const deadline = Date.now() + 8 * 60 * 1000;
  while (Date.now() < deadline) {
    const task = await runwayFetch(`/v1/tasks/${taskId}`, { method: "GET" });
    if (task.status === "SUCCEEDED") {
      const output = Array.isArray(task.output) ? task.output[0] : task.output;
      if (!output) throw new Error("No output");
      return output;
    }
    if (task.status === "FAILED" || task.status === "CANCELLED") {
      throw new Error(task.failure || task.failureCode || task.status);
    }
    process.stdout.write(`status: ${task.status} \r`);
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("Timed out waiting for Runway task");
}

function condense(s, max = 480) {
  const c = s.trim().replace(/\s+/g, " ");
  if (c.length <= max) return c;
  const cut = c.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${cut.slice(0, sp > 0 ? sp : max)}…`;
}

function imagePrompt(i) {
  return `${condense(VIBE)}. ${INTENSITY[i]}. ${IMAGE_SUFFIX}`.slice(0, 1000);
}
function motionPrompt(i) {
  return `${condense(VIBE)}. ${INTENSITY[i]}. ${MOTION_SUFFIX}`.slice(0, 1000);
}

async function persist(supabase, sourceUrl, filename, contentType) {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const path = `storyboards/${filename}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true });
  }

  const frames = [];
  for (let i = 0; i < FRAME_COUNT; i += 1) {
    console.log(`\n=== Frame ${i + 1}/${FRAME_COUNT}: inventing still ===`);
    const imgTask = await runwayFetch("/v1/text_to_image", {
      method: "POST",
      body: JSON.stringify({
        model: "gen4_image",
        promptText: imagePrompt(i),
        ratio: "1920:1080",
      }),
    });
    const imgUrl = await waitForTask(imgTask.id);
    const sceneUrl = await persist(
      supabase,
      imgUrl,
      `${EVENT_ID}-v1-scene-${i + 1}-${Date.now()}.jpg`,
      "image/jpeg"
    );
    console.log("scene:", sceneUrl);

    console.log(`=== Frame ${i + 1}/${FRAME_COUNT}: animating 10s loop ===`);
    const vidTask = await runwayFetch("/v1/image_to_video", {
      method: "POST",
      body: JSON.stringify({
        model: "gen4_turbo",
        promptImage: sceneUrl,
        promptText: motionPrompt(i),
        ratio: "1920:1080",
        duration: VIDEO_DURATION,
      }),
    });
    const vidUrl = await waitForTask(vidTask.id);
    const videoUrl = await persist(
      supabase,
      vidUrl,
      `${EVENT_ID}-v1-frame-${i + 1}-${Date.now()}.mp4`,
      "video/mp4"
    );
    console.log("video:", videoUrl);

    frames.push({
      sceneUrl,
      videoUrl,
      energy: FRAME_COUNT > 1 ? i / (FRAME_COUNT - 1) : 1,
    });
  }

  console.log("\nPatching event worldConfig…");
  const eventRes = await fetch(`${API_BASE}/api/events/${EVENT_ID}`);
  const event = await eventRes.json();
  const worldConfig = {
    ...(event.worldConfig || {}),
    title: event.worldConfig?.title || "Thresholds Song Garden",
    primaryColor: event.worldConfig?.primaryColor || "#0E1F24",
    accentColor: event.worldConfig?.accentColor || "#E2B86A",
    animationPreset: event.worldConfig?.animationPreset || "particles",
    presenceSimulationEnabled: event.worldConfig?.presenceSimulationEnabled ?? true,
    heroArtworkUrl: frames[0]?.sceneUrl || event.worldConfig?.heroArtworkUrl || null,
    worldSceneStages: [
      { threshold: 0, sceneUrl: frames[0].sceneUrl },
      { threshold: 0.45, sceneUrl: frames[frames.length - 1].sceneUrl },
    ],
    worldStoryboard: frames,
    aiArtworkPrompt: event.worldConfig?.aiArtworkPrompt || VIBE,
  };
  const patch = await fetch(`${API_BASE}/api/events/${EVENT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      worldConfig,
      heroImage: frames[0]?.sceneUrl || "",
      heroImageMode: "color",
    }),
  });
  const patched = await patch.json();
  console.log("HTTP", patch.status, "frames:", patched.worldConfig?.worldStoryboard?.length);
  fs.writeFileSync("/tmp/thresholds-world-v1-frames.json", JSON.stringify(frames, null, 2));
  console.log("Wrote /tmp/thresholds-world-v1-frames.json");
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
