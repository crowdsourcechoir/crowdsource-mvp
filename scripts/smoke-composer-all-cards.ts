/**
 * Composer card media load smoke tests (no Supabase required).
 * Run: npx tsx scripts/smoke-composer-all-cards.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import {
  agentMediaPathFromUrlOrPath,
  proxiedAgentMediaUrl,
} from "../lib/agent-media/storage-upload";

const lines: string[] = [];
let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  const line = `${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`;
  lines.push(line);
  console.log(line);
  if (!ok) failed += 1;
}

function makeWav(seconds = 0.05, sampleRate = 8000) {
  const n = Math.floor(seconds * sampleRate);
  const dataSize = n * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

async function main() {
  const cases: Array<{ name: string; input: string; expectPath?: string | null; expectProxy?: string }> = [
    {
      name: "bare conversation path",
      input: "conversations/abc/photo-1.jpg",
      expectPath: "conversations/abc/photo-1.jpg",
      expectProxy: "/api/agent/media?path=conversations%2Fabc%2Fphoto-1.jpg",
    },
    {
      name: "public object URL",
      input:
        "https://xyz.supabase.co/storage/v1/object/public/agent-media/conversations/abc/video-1.webm",
      expectPath: "conversations/abc/video-1.webm",
    },
    {
      name: "signed object URL",
      input:
        "https://xyz.supabase.co/storage/v1/object/sign/agent-media/conversations/abc/audio-1.wav?token=abc",
      expectPath: "conversations/abc/audio-1.wav",
    },
    {
      name: "render image URL",
      input:
        "https://xyz.supabase.co/storage/v1/render/image/public/agent-media/conversations/abc/photo-2.jpg",
      expectPath: "conversations/abc/photo-2.jpg",
    },
    {
      name: "renamed bucket still extracts conversations/",
      input:
        "https://xyz.supabase.co/storage/v1/object/public/legacy-bucket/conversations/abc/video-9.mp4",
      expectPath: "conversations/abc/video-9.mp4",
    },
    {
      name: "already proxied",
      input: "/api/agent/media?path=conversations%2Fabc%2Fphoto-1.jpg",
      expectPath: "conversations/abc/photo-1.jpg",
      expectProxy: "/api/agent/media?path=conversations%2Fabc%2Fphoto-1.jpg",
    },
    {
      name: "data URL passthrough",
      input: "data:image/jpeg;base64,aaaa",
      expectPath: null,
      expectProxy: "data:image/jpeg;base64,aaaa",
    },
  ];

  for (const c of cases) {
    const path = agentMediaPathFromUrlOrPath(c.input);
    const proxy = proxiedAgentMediaUrl(c.input);
    if (c.expectPath !== undefined) {
      check(`${c.name} path`, path === c.expectPath, `got ${path}`);
    }
    if (c.expectProxy !== undefined) {
      check(`${c.name} proxy`, proxy === c.expectProxy, `got ${proxy}`);
    } else if (c.expectPath) {
      check(
        `${c.name} proxy`,
        proxy === `/api/agent/media?path=${encodeURIComponent(c.expectPath)}`,
        `got ${proxy}`
      );
    }
  }

  const bad = proxiedAgentMediaUrl(
    "https://xyz.supabase.co/storage/v1/object/public/agent-media/not-conversations/x.mp4"
  );
  check("unparseable supabase URL blocked", bad === "", `got ${JSON.stringify(bad)}`);

  process.env.USE_LOCAL_EVENTS = "true";
  const { localSonggardenAddClip } = await import("../lib/local-songgarden-store");
  const { GET: getAudio } = await import("../app/api/songgarden/[clipId]/audio/route");

  const eventId = `card-smoke-${Date.now()}`;
  const clip = await localSonggardenAddClip({
    eventId,
    category: "other",
    filename: "will-you-sing.wav",
    mimeType: "audio/wav",
    durationMs: 50,
    deviceId: "smoke",
    audioBuffer: makeWav(),
    ext: "wav",
    label: "WILL YOU SING",
  });

  const audioRes = await getAudio(
    new Request(`http://localhost/api/songgarden/${clip.id}/audio?eventId=${eventId}`),
    { params: Promise.resolve({ clipId: clip.id }) }
  );
  const audioBody = Buffer.from(await audioRes.arrayBuffer());
  check("sound card audio status", audioRes.status === 200, `status=${audioRes.status}`);
  check("sound card audio is WAV", audioBody.slice(0, 4).toString() === "RIFF");
  check("sound card no redirect", audioRes.status !== 302 && !audioRes.headers.get("location"));

  const { GET: getMedia } = await import("../app/api/agent/media/route");
  const badMedia = await getMedia(
    new Request("http://localhost/api/agent/media?path=../secret")
  );
  check("agent media rejects traversal", badMedia.status === 400, `status=${badMedia.status}`);

  const missingMedia = await getMedia(
    new Request(
      "http://localhost/api/agent/media?path=conversations%2Fmissing%2Fvideo-1.webm"
    )
  );
  check(
    "agent media never redirects",
    missingMedia.status !== 302 && !missingMedia.headers.get("location"),
    `status=${missingMedia.status}`
  );

  // Photo detection for proxied URLs (ComposerMediaCard)
  const proxyPhoto = proxiedAgentMediaUrl("conversations/abc/photo-99.jpg") || "";
  const isPhoto =
    /\.(jpe?g|png|webp|gif)(\?|$)/i.test(decodeURIComponent(proxyPhoto)) ||
    /photo-/i.test(decodeURIComponent(proxyPhoto));
  check("photo detect on proxied URL", isPhoto, proxyPhoto);

  const proxyVideo = proxiedAgentMediaUrl("conversations/abc/video-99.webm") || "";
  const isVideoPhoto =
    /\.(jpe?g|png|webp|gif)(\?|$)/i.test(decodeURIComponent(proxyVideo)) ||
    /photo-/i.test(decodeURIComponent(proxyVideo));
  check("video not misclassified as photo", !isVideoPhoto, proxyVideo);

  mkdirSync("/opt/cursor/artifacts", { recursive: true });
  const summary = [...lines, `failed=${failed}`, `clipId=${clip.id}`, `eventId=${eventId}`].join(
    "\n"
  );
  writeFileSync("/opt/cursor/artifacts/composer-all-cards-smoke.log", summary + "\n");
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
