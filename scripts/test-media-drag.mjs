/**
 * Drag metadata for Composer photos and videos. Text is not a drag source.
 * Run: npx tsx scripts/test-media-drag.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const { mediaDragMeta, isPhotoMediaUrl } = await load("lib/composer/media-drag.ts");

  const photo = mediaDragMeta(
    "/api/agent/media?path=conversations%2Fabc%2Fphoto-99.jpg",
    "Joel Test"
  );
  assert.equal(photo.kind, "photo");
  assert.equal(photo.mime, "image/jpeg");
  assert.equal(photo.filename, "joel-test-photo.jpg");
  assert.equal(isPhotoMediaUrl("/api/agent/media?path=conversations%2Fabc%2Fphoto-99.jpg"), true);

  const video = mediaDragMeta(
    "/api/agent/media?path=conversations%2Fabc%2Fvideo-99.webm",
    "Anonymous"
  );
  assert.equal(video.kind, "video");
  assert.equal(video.mime, "video/webm");
  assert.equal(video.filename, "anonymous-video.webm");
  assert.equal(isPhotoMediaUrl("/api/agent/media?path=conversations%2Fabc%2Fvideo-99.webm"), false);

  const png = mediaDragMeta("https://cdn.example/shot.png", "");
  assert.equal(png.mime, "image/png");
  assert.equal(png.filename, "contribution-photo.png");

  console.log("ok — media drag meta");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
