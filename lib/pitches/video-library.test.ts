import assert from "node:assert/strict";
import { rememberedVideoTitle, uploadedLibraryVideos, videoTitleFromFilename } from "./video-library";

assert.equal(videoTitleFromFilename("Your love keeps liftin me higher.mp4"), "Your love keeps liftin me higher");
assert.equal(videoTitleFromFilename("C:\\clips\\Your_love.mov"), "Your love");

const stored =
  "https://zhrvcfehtxnromnwyjvv.supabase.co/storage/v1/object/public/song-garden-world-media/pitch-decks/conference-pitch-bellevue/promise-1794529293962.mp4";
assert.equal(rememberedVideoTitle(stored), "Your love keeps lifting me higher");

const videos = uploadedLibraryVideos([
  {
    name: "Conference Pitch: Bellevue",
    slides: [
      { video: ` ${stored} `, videoLabel: "  " },
      { video: stored, videoLabel: "Same file" },
      { video: "javascript:alert(1)" },
    ],
  },
  {
    name: "Visit Bellevue",
    slides: [{ video: "https://cdn.example/loop.mp4", videoLabel: "Hands up" }],
  },
]);

assert.deepEqual(
  videos.map((video) => video.label),
  ["Your love keeps lifting me higher", "Hands up"]
);

console.log("video library ok", videos.length);
