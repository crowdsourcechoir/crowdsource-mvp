/**
 * Smoke: salmon grade must apply to the video element, not only a still under it.
 * Run: npx tsx scripts/smoke-graded-video-overlay.tsx
 */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GradedPhoto } from "@/components/pitch/GradedPhoto";
import { SlideBackground } from "@/components/pitch/SlideBackground";

const graded = renderToStaticMarkup(
  <GradedPhoto
    src="/pitch/library/conductor.jpg"
    alt="Conductor"
    video="https://cdn.example/loop.mp4"
    overlay="salmon"
    amount={0.7}
    color="#3366FF"
  />
);

assert.match(graded, /<video[^>]+src="https:\/\/cdn\.example\/loop\.mp4"/);
assert.match(graded, /poster="\/pitch\/library\/conductor\.jpg"/);
assert.match(graded, /filter:url\(#pitch-salmon-/);
assert.match(graded, /<feFuncR/);
assert.doesNotMatch(graded, /<img /);

const plain = renderToStaticMarkup(
  <GradedPhoto src="/pitch/library/conductor.jpg" alt="Conductor" video="https://cdn.example/loop.mp4" />
);
assert.match(plain, /<video[^>]+src="https:\/\/cdn\.example\/loop\.mp4"/);
assert.doesNotMatch(plain, /filter:url\(/);

const viaSlide = renderToStaticMarkup(
  <SlideBackground
    slide={{
      image: "/pitch/library/conductor.jpg",
      imageAlt: "Conductor",
      video: "https://cdn.example/loop.mp4",
      photoOverlay: "salmon",
      photoOverlayAmount: 1,
    }}
  />
);
assert.match(viaSlide, /<video[^>]+src="https:\/\/cdn\.example\/loop\.mp4"/);
assert.match(viaSlide, /filter:url\(#pitch-salmon-/);
assert.doesNotMatch(viaSlide, /<img /);

console.log("graded video overlay smoke ok");
