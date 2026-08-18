/**
 * Smoke: hosted hero URL filtering + storage filename recovery.
 * Run: node scripts/test-event-hero-thumbs.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  return import(pathToFileURL(path.join(process.cwd(), rel)).href);
}

async function main() {
  const {
    hostedHeroUrl,
    heroStoragePrefixes,
    newestHeroUrlByPrefix,
    resolveHeroFromStorageFilenames,
    applyHeroAttachments,
    EVENT_LIST_SELECT,
    EVENT_DETAIL_SELECT,
  } = await load("lib/events-db.ts");

  assert.equal(hostedHeroUrl(""), "");
  assert.equal(hostedHeroUrl("   "), "");
  assert.equal(hostedHeroUrl("data:image/png;base64,AAAA"), "");
  assert.equal(hostedHeroUrl("https://cdn.example/hero.jpg"), "https://cdn.example/hero.jpg");
  assert.equal(hostedHeroUrl("http://cdn.example/hero.jpg"), "http://cdn.example/hero.jpg");
  assert.equal(hostedHeroUrl("/song-garden-v2/heroes/x.jpg"), "/song-garden-v2/heroes/x.jpg");
  assert.equal(hostedHeroUrl("not-a-url"), "");

  assert.ok(!/(^|,)hero_image(,|$)/.test(EVENT_LIST_SELECT));
  assert.ok(!/(^|,)hero_image(,|$)/.test(EVENT_DETAIL_SELECT));
  assert.ok(EVENT_LIST_SELECT.includes("hero_image_mode"));

  const id = "2083f502-45be-4f3e-b16c-0b1eb9f1df44";
  const prefixes = heroStoragePrefixes(id, "circle-of-friends");
  assert.ok(prefixes.includes(id));
  assert.ok(prefixes.includes("circle-of-friends"));

  const urlByPrefix = newestHeroUrlByPrefix(
    [
      { name: `${id}-hero.jpg`, created_at: "2026-08-01T00:00:00Z" },
      { name: `${id}-hero-999.jpg`, created_at: "2026-08-10T00:00:00Z" },
      { name: "circle-of-friends-hero-1.jpg", created_at: "2026-07-01T00:00:00Z" },
      { name: "other-event-hero.jpg", created_at: "2026-08-11T00:00:00Z" },
      { name: "readme.txt" },
    ],
    (name) => `https://storage.example/heroes/${name}`
  );

  assert.equal(
    urlByPrefix.get(id),
    `https://storage.example/heroes/${id}-hero-999.jpg`
  );
  assert.equal(
    resolveHeroFromStorageFilenames({ id, slug: "circle-of-friends" }, urlByPrefix),
    `https://storage.example/heroes/${id}-hero-999.jpg`
  );
  assert.equal(
    resolveHeroFromStorageFilenames({ id: "missing", slug: "circle-of-friends" }, urlByPrefix),
    "https://storage.example/heroes/circle-of-friends-hero-1.jpg"
  );
  assert.equal(resolveHeroFromStorageFilenames({ id: "nope", slug: "nope" }, urlByPrefix), "");

  const events = [
    { id: "a", slug: "alpha", heroImage: "" },
    { id: "b", slug: "beta", heroImage: "" },
    { id: "c", slug: "gamma", heroImage: "" },
  ];
  const persist = applyHeroAttachments(
    events,
    new Map([
      ["a", "https://cdn.example/a.jpg"],
      ["c", "data:image/png;base64,xxxx"],
    ]),
    new Map([
      ["a", "https://storage.example/should-not-win.jpg"],
      ["b", "https://storage.example/b.jpg"],
    ])
  );
  assert.equal(events[0].heroImage, "https://cdn.example/a.jpg");
  assert.equal(events[1].heroImage, "https://storage.example/b.jpg");
  assert.equal(events[2].heroImage, "");
  assert.deepEqual(persist, [{ id: "b", url: "https://storage.example/b.jpg" }]);

  console.log("ok — hosted hero filter + storage recovery");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
