import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { initialMeetingSlides } from "./initial-meeting";
import { PHOTO_LIBRARY } from "./photo-library";

const ids = PHOTO_LIBRARY.map((photo) => photo.id);
const srcs = PHOTO_LIBRARY.map((photo) => photo.src);
assert.equal(new Set(ids).size, ids.length, "library ids must be unique");
assert.equal(new Set(srcs).size, srcs.length, "library files must be unique");

for (const photo of PHOTO_LIBRARY) {
  assert.equal(photo.src.startsWith("/pitch/library/"), true);
  const file = path.join(process.cwd(), "public", photo.src);
  assert.equal(existsSync(file), true, photo.src);
}

const deckImages = initialMeetingSlides.map((slide) => slide.image);
assert.equal(new Set(deckImages).size, deckImages.length, "each slide needs its own photo");
for (const image of deckImages) {
  assert.equal(srcs.includes(image), true, image);
}

const bookOnDeck = initialMeetingSlides.filter((slide) =>
  PHOTO_LIBRARY.some((photo) => photo.src === slide.image && photo.source === "book"),
);
assert.equal(bookOnDeck.length >= 4, true);

console.log("photo library ok", PHOTO_LIBRARY.length, "photos", deckImages.length, "slides");
