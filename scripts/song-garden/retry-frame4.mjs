/**
 * Retry frame 4 video only, then patch worldStoryboard with all 4 frames.
 */
import { createClient } from "@supabase/supabase-js";

const EVENT_ID = "bc2970aa-8516-4f51-9e60-a85c692cafd9";
const RUNWAY_API_BASE = "https://api.dev.runwayml.com";
const RUNWAY_VERSION = "2024-11-06";
const BUCKET = process.env.SONG_GARDEN_MEDIA_BUCKET || "song-garden-world-media";

const SCENE_4 =
  "https://zhrvcfehtxnromnwyjvv.supabase.co/storage/v1/object/public/song-garden-world-media/storyboards/bc2970aa-8516-4f51-9e60-a85c692cafd9-v2-scene-4-1784751187581.jpg";

const FRAMES_DONE = [
  {
    sceneUrl:
      "https://zhrvcfehtxnromnwyjvv.supabase.co/storage/v1/object/public/song-garden-world-media/storyboards/bc2970aa-8516-4f51-9e60-a85c692cafd9-v2-scene-1-1784750960800.jpg",
    videoUrl:
      "https://zhrvcfehtxnromnwyjvv.supabase.co/storage/v1/object/public/song-garden-world-media/storyboards/bc2970aa-8516-4f51-9e60-a85c692cafd9-v2-frame-1-1784751014757.mp4",
    energy: 0,
  },
  {
    sceneUrl:
      "https://zhrvcfehtxnromnwyjvv.supabase.co/storage/v1/object/public/song-garden-world-media/storyboards/bc2970aa-8516-4f51-9e60-a85c692cafd9-v2-scene-2-1784751047756.jpg",
    videoUrl:
      "https://zhrvcfehtxnromnwyjvv.supabase.co/storage/v1/object/public/song-garden-world-media/storyboards/bc2970aa-8516-4f51-9e60-a85c692cafd9-v2-frame-2-1784751089688.mp4",
    energy: 1 / 3,
  },
  {
    sceneUrl:
      "https://zhrvcfehtxnromnwyjvv.supabase.co/storage/v1/object/public/song-garden-world-media/storyboards/bc2970aa-8516-4f51-9e60-a85c692cafd9-v2-scene-3-1784751122444.jpg",
    videoUrl:
      "https://zhrvcfehtxnromnwyjvv.supabase.co/storage/v1/object/public/song-garden-world-media/storyboards/bc2970aa-8516-4f51-9e60-a85c692cafd9-v2-frame-3-1784751155651.mp4",
    energy: 2 / 3,
  },
];

const MOTION =
  "Full bloom regenerative ecosystem, radiant bioluminescent greens and electric cyan, Sphere reflecting community patterns, dense glowing seed network. Subtle ambient motion only, slow drifting light and haze, camera locked in place, seamless looping atmosphere, no people walking into frame, no text or logos.";

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
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const task = await runwayFetch(`/v1/tasks/${taskId}`, { method: "GET" });
    console.log("status:", task.status, task.failure || "");
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
  throw new Error("Timed out");
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

  console.log("Retrying frame 4 video…");
  const vidTask = await runwayFetch("/v1/image_to_video", {
    method: "POST",
    body: JSON.stringify({
      model: "gen4_turbo",
      promptImage: SCENE_4,
      promptText: MOTION.slice(0, 1000),
      ratio: "1280:720",
      duration: 10,
    }),
  });
  const vidUrl = await waitForTask(vidTask.id);
  const videoUrl = await persist(
    supabase,
    vidUrl,
    `${EVENT_ID}-v2-frame-4-${Date.now()}.mp4`,
    "video/mp4"
  );
  console.log("video:", videoUrl);

  const frames = [
    ...FRAMES_DONE,
    { sceneUrl: SCENE_4, videoUrl, energy: 1 },
  ];

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
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
