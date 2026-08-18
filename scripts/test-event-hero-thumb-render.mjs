/**
 * SSR: EventHeroThumb must not emit <img src="">.
 * Run: npx tsx scripts/test-event-hero-thumb-render.mjs
 */
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  globalThis.React = React;
  const { default: EventHeroThumb } = await load("components/EventHeroThumb.tsx");
  const withSrc = renderToStaticMarkup(
    createElement(EventHeroThumb, {
      src: "https://cdn.example/hero.jpg",
      title: "Gather",
    })
  );
  const empty = renderToStaticMarkup(
    createElement(EventHeroThumb, { src: "", title: "Thresholds" })
  );
  const dataUri = renderToStaticMarkup(
    createElement(EventHeroThumb, {
      src: "data:image/png;base64,AAAA",
      title: "Inline",
    })
  );

  assert.match(withSrc, /<img src="https:\/\/cdn.example\/hero.jpg"/);
  assert.doesNotMatch(empty, /<img/);
  assert.match(empty, />T</);
  assert.doesNotMatch(dataUri, /<img/);
  assert.match(dataUri, />I</);

  console.log("ok — EventHeroThumb SSR (hosted img, empty placeholder, no data-URI img)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
