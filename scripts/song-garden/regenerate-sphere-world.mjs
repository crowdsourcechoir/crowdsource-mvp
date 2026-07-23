/**
 * Local regenerator — invents a NEW Song Garden world from vibe (text→image→10s video)
 * and patches the event. Bypasses the Next route timeout so a multi-frame run can finish.
 *
 * Usage: node --env-file=.env.local scripts/song-garden/regenerate-sphere-world.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const EVENT_ID = "bc2970aa-8516-4f51-9e60-a85c692cafd9";
const FRAME_COUNT = 4;
const VIDEO_DURATION = 10;
const RUNWAY_API_BASE = "https://api.dev.runwayml.com";
const RUNWAY_VERSION = "2024-11-06";
const BUCKET = process.env.SONG_GARDEN_MEDIA_BUCKET || "song-garden-world-media";

const VIBE = `Song Garden at Sphere Las Vegas. Mojave Desert resilience and hidden life meeting the Las Vegas Strip spectacle. Sphere as a gathering place of immersive media and collective presence. Organic desert forms intertwine with luminous digital ecosystems — cacti, sandstone dunes, desert blooms merge with generative light, holographic networks, and a glowing mycelial web of seeds planted by Ethereum builders, creators, artists, and dreamers. Premium cinematic: warm desert sunset into electric night. Sandstone, desert sage, warm gold, copper, deep indigo, electric cyan, soft violet, bioluminescent greens. Living regenerative ecosystem, not a conference.`;

const INTENSITY = [
  "quiet dormant desert dusk, soft sandstone dunes, faint Sphere glow on the horizon, sparse bioluminescent seeds barely lit, calm empty pathways",
  "early awakening, desert blooms beginning to open, soft cyan mycelial threads connecting a few glowing seeds, Sphere faintly pulsing in the distance",
  "living garden emerging, cacti and digital plants intertwined, warm gold and indigo light, mycelial network spreading, pathways starting to pulse",
  "full bloom regenerative ecosystem, radiant bioluminescent greens and electric cyan, Sphere reflecting community patterns, dense glowing seed network, optimistic cinematic energy",
];

const IMAGE_SUFFIX =
  "Premium cinematic wide environment concept art, no people in foreground, no readable text or logos, desert sage sandstone warm gold copper deep indigo electric cyan soft violet bioluminescent green color palette.";
const MOTION_SUFFIX =
  "Subtle ambient motion only, slow drifting light, camera locked in place, seamless looping atmosphere, keep the scene sharp and clear, no soft focus, no heavy haze or blur, no people walking into frame, no text or logos.";

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
    const sceneUrl = await persist(supabase, imgUrl, `${EVENT_ID}-v2-scene-${i + 1}-${Date.now()}.jpg`, "image/jpeg");
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
    const videoUrl = await persist(supabase, vidUrl, `${EVENT_ID}-v2-frame-${i + 1}-${Date.now()}.mp4`, "video/mp4");
    console.log("video:", videoUrl);

    frames.push({
      sceneUrl,
      videoUrl,
      energy: FRAME_COUNT > 1 ? i / (FRAME_COUNT - 1) : 1,
    });
  }

  console.log("\nPatching event worldConfig…");
  const eventRes = await fetch(`http://localhost:3000/api/events/${EVENT_ID}`);
  const event = await eventRes.json();
  const worldConfig = { ...(event.worldConfig || {}), worldStoryboard: frames };
  const patch = await fetch(`http://localhost:3000/api/events/${EVENT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worldConfig }),
  });
  const patched = await patch.json();
  console.log("HTTP", patch.status, "frames:", patched.worldConfig?.worldStoryboard?.length);
  fs.writeFileSync("/tmp/sphere-world-v2-frames.json", JSON.stringify(frames, null, 2));
  console.log("Wrote /tmp/sphere-world-v2-frames.json");
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
