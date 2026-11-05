import assert from "node:assert/strict";
import { slides as sobecaSlides } from "@/app/sobeca-song-garden/content";
import { initialMeetingSlides } from "./initial-meeting";
import {
  applyPassword,
  applyPitchPatch,
  createCustomPitch,
  duplicatePitch,
  findLoadedPitch,
  INITIAL_MEETING_ID,
  listLoadedPitches,
  mergeSlides,
  normalizeWebPitches,
  pitchTitle,
  seedSlides,
  slugify,
  SOBECA_PITCH_ID,
  toAdmin,
  uniqueSlug,
  type WebPitchesState,
} from "./model";

const sobeca = { slides: sobecaSlides, passwordHash: null as string | null };
const empty: WebPitchesState = { overrides: {}, custom: [] };

assert.equal(slugify("Initial Meeting Deck"), "initial-meeting-deck");
assert.equal(uniqueSlug("initial-meeting", new Set(["initial-meeting"])), "initial-meeting-2");

const seeded = seedSlides("Harbor pitch", "Invite the room to sing the mission.");
assert.equal(seeded[0]?.blocks[0]?.type, "title");
assert.equal(pitchTitle(seeded, "fallback"), "Harbor pitch");
assert.ok(seeded.some((slide) => slide.blocks.some((block) => "text" in block && block.text.includes("Invite the room"))));

const created = createCustomPitch(empty, { name: "Harbor pitch", prompt: "Invite the room to sing the mission.", live: true, passwordHash: null }, { id: "pitch_abcd", now: "2026-11-05T00:00:00.000Z" });
assert.ok(!("error" in created));
if ("error" in created) throw new Error("create failed");
assert.equal(created.pitch.slug, "harbor-pitch");
assert.equal(created.pitch.live, true);
assert.equal(created.pitch.passwordHash, null);

const missingPrompt = createCustomPitch(empty, { name: "Harbor", prompt: "  ", live: true, passwordHash: null }, { id: "pitch_abcd", now: "2026-11-05T00:00:00.000Z" });
assert.equal("error" in missingPrompt && missingPrompt.error, "Prompt is required.");

const reserved = createCustomPitch(empty, { name: "Initial Meeting", prompt: "A second meeting deck.", live: false, passwordHash: "salt:hash" }, { id: "pitch_zzzz", now: "2026-11-05T00:00:00.000Z" });
assert.ok(!("error" in reserved));
if ("error" in reserved) throw new Error("reserved create failed");
assert.equal(reserved.pitch.slug, "initial-meeting-2");
assert.equal(reserved.pitch.passwordHash, "salt:hash");

const listed = listLoadedPitches(empty, sobeca);
assert.deepEqual(listed.map((pitch) => pitch.id), [SOBECA_PITCH_ID, INITIAL_MEETING_ID]);
assert.equal(listed[1]?.name, "Initial Meeting Deck");
assert.equal(listed[1]?.live, true);
assert.equal(listed[1]?.href, "/pitch/initial-meeting");
assert.equal(listed[1]?.slides.length, initialMeetingSlides.length);
assert.equal(toAdmin(listed[1]!).protected, false);
assert.equal("passwordHash" in toAdmin(listed[1]!), false);

const hidden = listLoadedPitches(
  { overrides: { [INITIAL_MEETING_ID]: { live: false, passwordHash: "salt:hash", prompt: "Keep this private." } }, custom: [] },
  { slides: sobecaSlides, passwordHash: "sobeca:hash" }
);
assert.equal(hidden[1]?.live, false);
assert.equal(hidden[1]?.passwordHash, "salt:hash");
assert.equal(hidden[1]?.prompt, "Keep this private.");
assert.equal(hidden[0]?.passwordHash, "sobeca:hash");
assert.equal(toAdmin(hidden[0]!).protected, true);

const meeting = findLoadedPitch(empty, INITIAL_MEETING_ID, sobeca);
assert.ok(meeting);
if (!meeting) throw new Error("missing meeting");
const edited = mergeSlides(meeting.slides, [{ id: "title", blocks: [{ type: "title", text: "Changed headline" }] }]);
assert.equal(edited[0]?.blocks[0] && "text" in edited[0].blocks[0] ? edited[0].blocks[0].text : "", "Changed headline");
assert.equal(edited[0]?.image, initialMeetingSlides[0]?.image);

const patched = applyPitchPatch(empty, meeting, { slides: edited, prompt: "A tighter brief." }, "2026-11-05T01:00:00.000Z");
assert.ok(!("error" in patched));
if ("error" in patched) throw new Error("patch failed");
assert.equal(patched.pitch.prompt, "A tighter brief.");
const again = findLoadedPitch(patched.state, INITIAL_MEETING_ID, sobeca);
assert.equal(again?.slides[0]?.blocks[0] && "text" in again.slides[0].blocks[0] ? again.slides[0].blocks[0].text : "", "Changed headline");

const reset = applyPitchPatch(patched.state, patched.pitch, { reset: true }, "2026-11-05T02:00:00.000Z");
assert.ok(!("error" in reset));
if ("error" in reset) throw new Error("reset failed");
assert.equal(reset.state.overrides[INITIAL_MEETING_ID]?.slides, null);
assert.equal(findLoadedPitch(reset.state, INITIAL_MEETING_ID, sobeca)?.slides[0]?.blocks[0] && "text" in (findLoadedPitch(reset.state, INITIAL_MEETING_ID, sobeca)?.slides[0]?.blocks[0] ?? {}) ? (findLoadedPitch(reset.state, INITIAL_MEETING_ID, sobeca)?.slides[0]?.blocks[0] as { text: string }).text : "", "Make the moment undeniable.");

const copy = duplicatePitch(reset.state, meeting, { id: "pitch_copy1", now: "2026-11-05T03:00:00.000Z" });
assert.ok(!("error" in copy));
if ("error" in copy) throw new Error("duplicate failed");
assert.equal(copy.pitch.name, "Copy of Initial Meeting Deck");
assert.equal(copy.pitch.passwordHash, meeting.passwordHash);
assert.equal(copy.pitch.slides.length, meeting.slides.length);
assert.notEqual(copy.pitch.slides, meeting.slides);
const locked = applyPassword(copy.state, { ...findLoadedPitch(copy.state, copy.pitch.id, sobeca)!, passwordHash: null }, "next:hash");
assert.equal(findLoadedPitch(locked.state, copy.pitch.id, sobeca)?.passwordHash, "next:hash");

const junk = normalizeWebPitches({
  overrides: { "not-a-pitch": { live: false }, [INITIAL_MEETING_ID]: { live: false, prompt: "  kept  " } },
  custom: [{ id: "nope", name: "Bad", prompt: "x", slides: [] }, created.pitch, { ...created.pitch, slug: "other" }],
});
assert.equal(junk.overrides[INITIAL_MEETING_ID]?.live, false);
assert.equal(junk.overrides[INITIAL_MEETING_ID]?.prompt, "kept");
assert.equal(junk.overrides["not-a-pitch"], undefined);
assert.equal(junk.custom.length, 1);
assert.equal(junk.custom[0]?.id, "pitch_abcd");

console.log("pitch model tests ok");
