import assert from "node:assert/strict";
import { slides as sobecaSlides } from "@/app/sobeca-song-garden/content";
import { initialMeetingSlides } from "./initial-meeting";
import {
  acceptSlides,
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
  hrefForPitch,
  parsePitchUrl,
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
assert.equal(created.pitch.organizationId, null);

const orgId = "11111111-1111-4111-8111-111111111111";
const linked = createCustomPitch(
  empty,
  { name: "Harbor pitch", prompt: "Invite the room to sing the mission.", live: false, passwordHash: null, organizationId: orgId.toUpperCase() },
  { id: "pitch_org1", now: "2026-11-05T00:00:00.000Z" }
);
assert.ok(!("error" in linked));
if ("error" in linked) throw new Error("org create failed");
assert.equal(linked.pitch.organizationId, orgId);
const badOrg = createCustomPitch(
  empty,
  { name: "Harbor pitch", prompt: "Invite the room to sing the mission.", live: true, passwordHash: null, organizationId: "not-an-org" },
  { id: "pitch_org2", now: "2026-11-05T00:00:00.000Z" }
);
assert.equal("error" in badOrg && badOrg.error, "Choose an organization from search.");
const kept = normalizeWebPitches({ custom: [linked.pitch, { ...linked.pitch, id: "pitch_org3", slug: "other", organizationId: "nope" }] });
assert.equal(kept.custom.find((pitch) => pitch.id === "pitch_org1")?.organizationId, orgId);
assert.equal(kept.custom.find((pitch) => pitch.id === "pitch_org3")?.organizationId, null);

const missingPrompt = createCustomPitch(empty, { name: "Harbor", prompt: "  ", live: true, passwordHash: null }, { id: "pitch_abcd", now: "2026-11-05T00:00:00.000Z" });
assert.equal("error" in missingPrompt && missingPrompt.error, "Prompt is required.");

const reserved = createCustomPitch(empty, { name: "Initial Meeting", prompt: "A second meeting deck.", live: false, passwordHash: "salt:hash" }, { id: "pitch_zzzz", now: "2026-11-05T00:00:00.000Z" });
assert.ok(!("error" in reserved));
if ("error" in reserved) throw new Error("reserved create failed");
assert.equal(reserved.pitch.slug, "initial-meeting-2");
assert.equal(reserved.pitch.passwordHash, "salt:hash");

const listed = listLoadedPitches(empty, sobeca);
assert.deepEqual(listed.map((pitch) => pitch.id), [SOBECA_PITCH_ID, INITIAL_MEETING_ID, "strategy", "visit-bellevue"]);
assert.equal(listed[3]?.name, "Visit Bellevue");
assert.equal(listed[3]?.href, "/pitch/visit-bellevue");
assert.equal(listed[2]?.name, "Strategy");
assert.equal(listed[2]?.href, "/pitch/strategy");
assert.equal(listed[2]?.slides[0] && "text" in listed[2].slides[0].blocks[1] ? listed[2].slides[0].blocks[1].text : "", "Strategy");
assert.equal(listed[1]?.name, "Initial Meeting Deck");
assert.equal(listed[1]?.live, true);
assert.equal(listed[1]?.href, "/pitch/initial-meeting");
assert.equal(listed[1]?.organizationId, null);
const assigned = applyPitchPatch(empty, listed[1]!, { organizationId: orgId }, "2026-11-05T03:00:00.000Z");
assert.ok(!("error" in assigned));
if ("error" in assigned) throw new Error("assign failed");
assert.equal(findLoadedPitch(assigned.state, INITIAL_MEETING_ID, sobeca)?.organizationId, orgId);
const cleared = applyPitchPatch(assigned.state, assigned.pitch, { organizationId: null }, "2026-11-05T04:00:00.000Z");
assert.ok(!("error" in cleared));
if ("error" in cleared) throw new Error("clear failed");
assert.equal(findLoadedPitch(cleared.state, INITIAL_MEETING_ID, sobeca)?.organizationId, null);
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
const styled = mergeSlides(meeting.slides, [{ id: "audience", blocks: [{ type: "title", text: "Bigger headline" }] }]);
const audience = styled.find((slide) => slide.id === "audience");
assert.equal(audience?.blocks[0]?.type, "title");
assert.equal(audience?.blocks[0] && "text" in audience.blocks[0] ? audience.blocks[0].text : "", "Bigger headline");
const pointed = mergeSlides(meeting.slides, [
  { id: "audience", blocks: [{}, { type: "heading2", text: "The room writes the song." }] },
]);
const pointedAudience = pointed.find((slide) => slide.id === "audience");
assert.equal(pointedAudience?.blocks[1]?.type, "heading2");
const mono = mergeSlides(meeting.slides, [
  { id: "audience", blocks: [{}, { type: "heading3", text: "Stories. **Hopes.**", bold: true }] },
]);
const monoAudience = mono.find((slide) => slide.id === "audience");
assert.equal(monoAudience?.blocks[1]?.type, "heading3");
assert.equal(monoAudience?.blocks[1] && "bold" in monoAudience.blocks[1] ? monoAudience.blocks[1].bold : false, true);
assert.equal(
  pointedAudience?.blocks[1] && "text" in pointedAudience.blocks[1] ? pointedAudience.blocks[1].text : "",
  "The room writes the song."
);

const ruled = acceptSlides([
  {
    id: "title",
    image: "/pitch/library/conductor.jpg",
    imageAlt: "A choir on stage",
    blocks: [
      { type: "paragraph", text: "Lead an accessible experience.", rule: true, bold: true },
      { type: "paragraph", text: "No mark." },
      { type: "heading", text: "Still a heading", rule: true },
    ],
  },
]);
const ruledParagraph = ruled?.[0]?.blocks[0];
assert.equal(ruledParagraph?.type, "paragraph");
assert.equal(ruledParagraph && "rule" in ruledParagraph ? ruledParagraph.rule : false, true);
assert.equal(ruledParagraph && "bold" in ruledParagraph ? ruledParagraph.bold : false, true);
assert.equal(ruled?.[0]?.blocks[1] && "rule" in ruled[0].blocks[1] ? ruled[0].blocks[1].rule : undefined, undefined);
assert.equal("rule" in (ruled?.[0]?.blocks[2] ?? {}), false);
const ruledMerge = mergeSlides(meeting.slides, [
  { id: "audience", blocks: [{}, { type: "paragraph", text: "Lead an accessible experience.", rule: true }] },
]);
const ruledAudience = ruledMerge.find((slide) => slide.id === "audience")?.blocks[1];
assert.equal(ruledAudience?.type, "paragraph");
assert.equal(ruledAudience && "rule" in ruledAudience ? ruledAudience.rule : false, true);

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

const copied = findLoadedPitch(copy.state, copy.pitch.id, sobeca);
assert.ok(copied);
if (!copied) throw new Error("missing copy");
const withLine = copied.slides.map((slide) => {
  if (slide.id !== "with-you") return slide;
  return {
    ...slide,
    blocks: slide.blocks.map((block) =>
      block.type === "list" ? { ...block, items: [...block.items, "One more step."] } : block
    ),
  };
});
const listSaved = applyPitchPatch(copy.state, copied, { slides: withLine }, "2026-11-05T04:00:00.000Z");
if ("error" in listSaved) throw new Error(listSaved.error);
const listLoaded = findLoadedPitch(listSaved.state, copied.id, sobeca);
const savedList = listLoaded?.slides.find((slide) => slide.id === "with-you")?.blocks.find((block) => block.type === "list");
assert.equal(savedList && savedList.type === "list" ? savedList.items.at(-1) : "", "One more step.");

const customLoaded = findLoadedPitch(created.state, created.pitch.id, sobeca);
assert.ok(customLoaded);
if (!customLoaded) throw new Error("missing custom");
const extended = customLoaded.slides.map((slide, index) =>
  index === 0 ? { ...slide, blocks: [...slide.blocks, { type: "paragraph" as const, text: "Added in the editor." }] } : slide
);
extended.push({
  id: "encore",
  image: customLoaded.slides[0]!.image,
  imageAlt: customLoaded.slides[0]!.imageAlt,
  blocks: [{ type: "heading", text: "Encore" }],
});
const customSaved = applyPitchPatch(created.state, customLoaded, { slides: extended }, "2026-11-05T05:00:00.000Z");
if ("error" in customSaved) throw new Error(customSaved.error);
const customAgain = findLoadedPitch(customSaved.state, customLoaded.id, sobeca);
assert.equal(customAgain?.slides.length, customLoaded.slides.length + 1);
assert.equal(customAgain?.slides.at(-1)?.id, "encore");
const added = customAgain?.slides[0]?.blocks.at(-1);
assert.equal(added && "text" in added ? added.text : "", "Added in the editor.");
const customTrimmed = applyPitchPatch(
  customSaved.state,
  customAgain!,
  {
    slides: customAgain!.slides.slice(0, -1).map((slide, index) =>
      index === 0 ? { ...slide, blocks: slide.blocks.slice(0, -1) } : slide
    ),
  },
  "2026-11-05T06:00:00.000Z"
);
if ("error" in customTrimmed) throw new Error(customTrimmed.error);
const customFinal = findLoadedPitch(customTrimmed.state, customLoaded.id, sobeca);
assert.equal(customFinal?.slides.length, customLoaded.slides.length);
assert.equal(customFinal?.slides[0]?.blocks.length, customLoaded.slides[0]?.blocks.length);

const emptyDeck = applyPitchPatch(customTrimmed.state, customFinal!, { slides: [] }, "2026-11-05T06:30:00.000Z");
assert.equal("error" in emptyDeck && emptyDeck.error, "A pitch needs at least one slide.");
const duplicateIds = applyPitchPatch(
  customTrimmed.state,
  customFinal!,
  { slides: [customFinal!.slides[0], customFinal!.slides[0]] },
  "2026-11-05T06:40:00.000Z"
);
assert.equal("error" in duplicateIds, true);

const meetingNow = findLoadedPitch(empty, INITIAL_MEETING_ID, sobeca);
assert.ok(meetingNow);
if (!meetingNow) throw new Error("missing meeting");
const withEncore = applyPitchPatch(
  empty,
  meetingNow,
  {
    slides: [
      ...meetingNow.slides,
      {
        id: "encore",
        image: meetingNow.slides[0]!.image,
        imageAlt: meetingNow.slides[0]!.imageAlt,
        blocks: [{ type: "heading", text: "Encore" }],
      },
    ],
  },
  "2026-11-05T07:00:00.000Z"
);
if ("error" in withEncore) throw new Error(withEncore.error);
assert.equal(findLoadedPitch(withEncore.state, INITIAL_MEETING_ID, sobeca)?.slides.at(-1)?.id, "encore");
const meetingReset = applyPitchPatch(withEncore.state, withEncore.pitch, { reset: true }, "2026-11-05T08:00:00.000Z");
assert.ok(!("error" in meetingReset));
if ("error" in meetingReset) throw new Error("meeting reset failed");
assert.equal(meetingReset.state.overrides[INITIAL_MEETING_ID]?.slides, null);
assert.equal(findLoadedPitch(meetingReset.state, INITIAL_MEETING_ID, sobeca)?.slides.length, initialMeetingSlides.length);

const pacedDeck = acceptSlides([
  {
    id: "title",
    image: meetingNow.slides[0]!.image,
    imageAlt: meetingNow.slides[0]!.imageAlt,
    reveal: "steps",
    blocks: [{ type: "heading", text: "One" }],
  },
]);
assert.equal(pacedDeck?.[0]?.reveal, "steps");
const withBottom = acceptSlides([
  {
    id: "title",
    image: meetingNow.slides[0]!.image,
    imageAlt: meetingNow.slides[0]!.imageAlt,
    bottom: "  On the next click  ",
    blocks: [{ type: "heading", text: "One" }],
  },
]);
assert.equal(withBottom?.[0]?.bottom, "On the next click");
const repeatedBottom = acceptSlides([
  {
    id: "title",
    image: meetingNow.slides[0]!.image,
    imageAlt: meetingNow.slides[0]!.imageAlt,
    bottom: "Our signature Anthem Experience.",
    blocks: [
      { type: "paragraph", text: "Our signature Anthem Experience." },
      { type: "line", text: "They sing it." },
    ],
  },
]);
assert.equal(repeatedBottom?.[0]?.bottom, undefined);
const revisedBottom = acceptSlides([
  {
    id: "title",
    image: meetingNow.slides[0]!.image,
    imageAlt: meetingNow.slides[0]!.imageAlt,
    bottom:
      "Our signature Anthem Experience transforms the people, purpose, and place behind a gathering into an original song—created specifically for that moment and the people who make it meaningful.",
    blocks: [
      {
        type: "paragraph",
        text: "Our signature Anthem Experience transforms the people, purpose, and place behind a gathering into an original song—created specifically for that moment and the people participating.",
      },
      { type: "line", text: "They don’t just hear it. They sing it." },
    ],
  },
]);
assert.equal(revisedBottom?.[0]?.bottom, undefined);
assert.equal(
  revisedBottom?.[0]?.blocks[0] && "text" in revisedBottom[0].blocks[0] ? revisedBottom[0].blocks[0].text.endsWith("people participating.") : false,
  true,
);
const markedRows = acceptSlides([
  {
    id: "title",
    image: meetingNow.slides[0]!.image,
    imageAlt: meetingNow.slides[0]!.imageAlt,
    blocks: [
      { type: "paragraph", text: "First.", click: true, rule: true },
      { type: "heading", text: "Second.", click: true },
      { type: "paragraph", text: "Stays." },
      { type: "list", items: ["A", "B", " "], clickItems: [1, 0, 9, 2] },
    ],
  },
]);
const markedBlocks = markedRows?.[0]?.blocks ?? [];
assert.equal(markedBlocks[0]?.type === "paragraph" && markedBlocks[0].click, true);
assert.equal(markedBlocks[0]?.type === "paragraph" && markedBlocks[0].rule, true);
assert.equal(markedBlocks[1]?.type === "heading" && markedBlocks[1].click, true);
assert.equal(markedBlocks[2]?.type === "paragraph" && markedBlocks[2].click, undefined);
assert.deepEqual(markedBlocks[3]?.type === "list" ? markedBlocks[3].clickItems : null, [0, 1]);
const blankBottom = acceptSlides([
  {
    id: "title",
    image: meetingNow.slides[0]!.image,
    imageAlt: meetingNow.slides[0]!.imageAlt,
    bottom: "   ",
    blocks: [{ type: "heading", text: "One" }],
  },
]);
assert.equal(blankBottom?.[0]?.bottom, undefined);
const droppedPace = acceptSlides([
  {
    id: "title",
    image: meetingNow.slides[0]!.image,
    imageAlt: meetingNow.slides[0]!.imageAlt,
    reveal: "together",
    blocks: [{ type: "heading", text: "One" }],
  },
]);
assert.equal(droppedPace?.[0]?.reveal, undefined);

const graded = acceptSlides([
  {
    id: "title",
    image: meetingNow.slides[0]!.image,
    imageAlt: meetingNow.slides[0]!.imageAlt,
    photoOverlay: "salmon",
    blocks: [{ type: "heading", text: "One" }],
  },
]);
assert.equal(graded?.[0]?.photoOverlay, "salmon");
assert.equal(graded?.[0]?.photoOverlayAmount, undefined);
const sheer = acceptSlides([
  {
    id: "title",
    image: meetingNow.slides[0]!.image,
    imageAlt: meetingNow.slides[0]!.imageAlt,
    photoOverlay: "salmon",
    photoOverlayAmount: 0.35,
    blocks: [{ type: "heading", text: "One" }],
  },
]);
assert.equal(sheer?.[0]?.photoOverlayAmount, 0.35);
const amountWithoutGrade = acceptSlides([
  {
    id: "title",
    image: meetingNow.slides[0]!.image,
    imageAlt: meetingNow.slides[0]!.imageAlt,
    photoOverlayAmount: 0.2,
    blocks: [{ type: "heading", text: "One" }],
  },
]);
assert.equal(amountWithoutGrade?.[0]?.photoOverlayAmount, undefined);
const colored = acceptSlides([
  {
    id: "title",
    image: meetingNow.slides[0]!.image,
    imageAlt: meetingNow.slides[0]!.imageAlt,
    photoOverlay: "salmon",
    photoOverlayColor: "#3366ff",
    blocks: [{ type: "heading", text: "One" }],
  },
]);
assert.equal(colored?.[0]?.photoOverlayColor, "#3366FF");
const defaultColor = acceptSlides([
  {
    id: "title",
    image: meetingNow.slides[0]!.image,
    imageAlt: meetingNow.slides[0]!.imageAlt,
    photoOverlay: "salmon",
    photoOverlayColor: "#e6579e",
    blocks: [{ type: "heading", text: "One" }],
  },
]);
assert.equal(defaultColor?.[0]?.photoOverlayColor, undefined);
const colorWithoutGrade = acceptSlides([
  {
    id: "title",
    image: meetingNow.slides[0]!.image,
    imageAlt: meetingNow.slides[0]!.imageAlt,
    photoOverlayColor: "#3366FF",
    blocks: [{ type: "heading", text: "One" }],
  },
]);
assert.equal(colorWithoutGrade?.[0]?.photoOverlayColor, undefined);
const droppedGrade = acceptSlides([
  {
    id: "title",
    image: meetingNow.slides[0]!.image,
    imageAlt: meetingNow.slides[0]!.imageAlt,
    photoOverlay: "blue",
    blocks: [{ type: "heading", text: "One" }],
  },
]);
assert.equal(droppedGrade?.[0]?.photoOverlay, undefined);

const junk = normalizeWebPitches({
  overrides: { "not-a-pitch": { live: false }, [INITIAL_MEETING_ID]: { live: false, prompt: "  kept  " } },
  custom: [{ id: "nope", name: "Bad", prompt: "x", slides: [] }, created.pitch, { ...created.pitch, slug: "other" }],
});
assert.equal(junk.overrides[INITIAL_MEETING_ID]?.live, false);
assert.equal(junk.overrides[INITIAL_MEETING_ID]?.prompt, "kept");
assert.equal(junk.overrides["not-a-pitch"], undefined);
assert.equal(junk.custom.length, 1);
assert.equal(junk.custom[0]?.id, "pitch_abcd");

assert.deepEqual(parsePitchUrl("anthem", INITIAL_MEETING_ID), { slug: "anthem" });
assert.deepEqual(parsePitchUrl("/pitch/anthem-experience/", "pitch_abcd"), { slug: "anthem-experience" });
assert.deepEqual(parsePitchUrl("/sobeca-song-garden", SOBECA_PITCH_ID), { slug: SOBECA_PITCH_ID });
assert.equal("error" in parsePitchUrl("/sobeca-song-garden", INITIAL_MEETING_ID), true);
assert.equal("error" in parsePitchUrl("/pitch/../admin", INITIAL_MEETING_ID), true);
assert.equal(hrefForPitch(SOBECA_PITCH_ID, SOBECA_PITCH_ID), "/sobeca-song-garden");
assert.equal(hrefForPitch(INITIAL_MEETING_ID, "anthem"), "/pitch/anthem");

const renamed = applyPitchPatch(copy.state, findLoadedPitch(copy.state, copy.pitch.id, sobeca)!, { slug: "/pitch/anthem" }, "2026-11-05T04:00:00.000Z");
assert.ok(!("error" in renamed));
if ("error" in renamed) throw new Error("rename failed");
assert.equal(renamed.pitch.href, "/pitch/anthem");
assert.equal(findLoadedPitch(renamed.state, "anthem", sobeca)?.id, copy.pitch.id);
const clash = applyPitchPatch(renamed.state, meeting, { slug: "anthem" }, "2026-11-05T05:00:00.000Z");
assert.equal("error" in clash && clash.error, "That address is already in use.");
const meetingUrl = applyPitchPatch(empty, meeting, { slug: "first-meeting" }, "2026-11-05T06:00:00.000Z");
assert.ok(!("error" in meetingUrl));
if ("error" in meetingUrl) throw new Error("meeting rename failed");
assert.equal(meetingUrl.pitch.href, "/pitch/first-meeting");
assert.equal(findLoadedPitch(meetingUrl.state, INITIAL_MEETING_ID, sobeca)?.href, "/pitch/first-meeting");
assert.equal(findLoadedPitch(meetingUrl.state, "first-meeting", sobeca)?.id, INITIAL_MEETING_ID);

console.log("pitch model tests ok");
