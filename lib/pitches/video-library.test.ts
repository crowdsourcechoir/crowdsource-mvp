import assert from "node:assert/strict";
import { uploadedLibraryVideos } from "./video-library";

const videos = uploadedLibraryVideos([
  {
    name: "Visit Bellevue",
    slides: [
      { video: " https://cdn.example/loop.mp4 ", imageAlt: "A room singing" },
      { video: "https://cdn.example/loop.mp4", imageAlt: "Same file" },
      { video: "javascript:alert(1)", imageAlt: "Bad" },
      { video: "  ", imageAlt: "Blank" },
    ],
  },
  {
    name: "Conference",
    slides: [{ video: "/pitch/library/custom.mp4", imageAlt: "Local file" }],
  },
  {
    slides: [{ video: "http://cdn.example/plain.mp4", imageAlt: "Insecure" }],
  },
  {
    slides: [{ video: "https://cdn.example/orphan.mp4" }],
  },
]);

assert.deepEqual(
  videos.map((video) => video.src),
  ["https://cdn.example/loop.mp4", "/pitch/library/custom.mp4", "https://cdn.example/orphan.mp4"]
);
assert.equal(videos[0]?.label, "Visit Bellevue");
assert.equal(videos[1]?.label, "Conference");
assert.equal(videos[2]?.label, "Uploaded video");

console.log("video library ok", videos.length);
