import assert from "node:assert/strict";
import { slides as sobecaSlides } from "@/app/sobeca-song-garden/content";
import { conferenceBellevueSlides } from "./conference-bellevue";
import { initialMeetingSlides } from "./initial-meeting";
import { nafsaSlides } from "./nafsa";
import {
  acceptSlides,
  applyPassword,
  applyPitchPatch,
  CONFERENCE_BELLEVUE_ID,
  createCustomPitch,
  duplicatePitch,
  findLoadedPitch,
  INITIAL_MEETING_ID,
  NAFSA_ID,
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
assert.deepEqual(listed.map((pitch) => pitch.id), [
  NAFSA_ID,
  CONFERENCE_BELLEVUE_ID,
  "visit-bellevue",
  "strategy",
  INITIAL_MEETING_ID,
  SOBECA_PITCH_ID,
]);
const visit = listed.find((pitch) => pitch.id === "visit-bellevue");
const conferencePitch = listed.find((pitch) => pitch.id === CONFERENCE_BELLEVUE_ID);
const strategyPitch = listed.find((pitch) => pitch.id === "strategy");
const meetingRow = listed.find((pitch) => pitch.id === INITIAL_MEETING_ID);
assert.equal(visit?.name, "Visit Bellevue");
assert.equal(visit?.href, "/pitch/visit-bellevue");
assert.equal(visit?.category, null);
assert.equal(conferencePitch?.name, "Conference Pitch: Bellevue");
assert.equal(conferencePitch?.href, "/pitch/conference-pitch-bellevue");
assert.equal(conferencePitch?.live, true);
assert.equal(conferencePitch?.slides.length, conferenceBellevueSlides.length);
assert.equal(
  conferencePitch?.slides[0]?.blocks[0] && "text" in conferencePitch.slides[0].blocks[0]
    ? conferencePitch.slides[0].blocks[0].text
    : "",
  "Make your next conference undeniable."
);
assert.equal(
  conferencePitch?.slides.at(-1)?.blocks.at(-1) && "text" in (conferencePitch.slides.at(-1)?.blocks.at(-1) ?? {})
    ? (conferencePitch.slides.at(-1)?.blocks.at(-1) as { text: string }).text
    : "",
  "Introduced by Visit Bellevue"
);
const nafsaPitch = listed.find((pitch) => pitch.id === NAFSA_ID);
assert.equal(nafsaPitch?.name, "NAFSA Pitch");
assert.equal(nafsaPitch?.href, "/pitch/nafsa-anthem");
assert.equal(nafsaPitch?.live, true);
assert.equal(nafsaPitch?.slides.length, nafsaSlides.length);
assert.equal(
  nafsaPitch?.slides[0]?.blocks[0] && "text" in nafsaPitch.slides[0].blocks[0]
    ? nafsaPitch.slides[0].blocks[0].text
    : "",
  "Make Future Ready Together undeniable."
);
assert.equal(
  nafsaPitch?.slides.at(-1)?.blocks.at(-1) && "text" in (nafsaPitch.slides.at(-1)?.blocks.at(-1) ?? {})
    ? (nafsaPitch.slides.at(-1)?.blocks.at(-1) as { text: string }).text
    : "",
  "sing@crowdsourcechoir.com"
);
const priorNafsa: WebPitchesState = {
  overrides: {},
  custom: [
    {
      id: "pitch_nafsa",
      slug: "nafsa-anthem",
      name: "NAFSA Pitch",
      prompt: "The earlier initial-meeting copy.",
      live: true,
      passwordHash: "salt:hash",
      organizationId: orgId,
      category: "conferences",
      workstream: "premium",
      slides: initialMeetingSlides,
      createdAt: "2026-11-10T00:00:00.000Z",
      updatedAt: "2026-11-12T00:00:00.000Z",
    },
  ],
};
const replaced = findLoadedPitch(priorNafsa, "nafsa-anthem", sobeca);
assert.equal(replaced?.id, NAFSA_ID);
assert.equal(replaced?.builtin, true);
assert.equal(
  replaced?.slides[0]?.blocks[0] && "text" in replaced.slides[0].blocks[0] ? replaced.slides[0].blocks[0].text : "",
  "Make Future Ready Together undeniable."
);
assert.equal(replaced?.organizationId, orgId);
assert.equal(replaced?.category, "conferences");
assert.equal(replaced?.workstream, "premium");
assert.equal(replaced?.passwordHash, "salt:hash");
assert.equal(
  listLoadedPitches(priorNafsa, sobeca).some((pitch) => pitch.id === "pitch_nafsa"),
  false
);
const clearedNafsaOrg = applyPitchPatch(priorNafsa, replaced!, { organizationId: null }, "2026-11-13T03:00:00.000Z");
assert.ok(!("error" in clearedNafsaOrg));
if ("error" in clearedNafsaOrg) throw new Error("nafsa org clear failed");
assert.equal(findLoadedPitch(clearedNafsaOrg.state, NAFSA_ID, sobeca)?.organizationId, null);
assert.equal(strategyPitch?.name, "Strategy");
assert.equal(strategyPitch?.href, "/pitch/strategy");
assert.equal(
  strategyPitch?.slides[0] && "text" in strategyPitch.slides[0].blocks[1] ? strategyPitch.slides[0].blocks[1].text : "",
  "Strategy"
);
assert.equal(meetingRow?.name, "Initial Meeting Deck");
assert.equal(meetingRow?.live, true);
assert.equal(meetingRow?.href, "/pitch/initial-meeting");
assert.equal(meetingRow?.organizationId, null);
const assigned = applyPitchPatch(empty, meetingRow!, { organizationId: orgId }, "2026-11-05T03:00:00.000Z");
assert.ok(!("error" in assigned));
if ("error" in assigned) throw new Error("assign failed");
assert.equal(findLoadedPitch(assigned.state, INITIAL_MEETING_ID, sobeca)?.organizationId, orgId);
const cleared = applyPitchPatch(assigned.state, assigned.pitch, { organizationId: null }, "2026-11-05T04:00:00.000Z");
assert.ok(!("error" in cleared));
if ("error" in cleared) throw new Error("clear failed");
assert.equal(findLoadedPitch(cleared.state, INITIAL_MEETING_ID, sobeca)?.organizationId, null);
assert.equal(meetingRow?.slides.length, initialMeetingSlides.length);
assert.equal(toAdmin(meetingRow!).protected, false);
assert.equal("passwordHash" in toAdmin(meetingRow!), false);
assert.equal(findLoadedPitch(assigned.state, INITIAL_MEETING_ID, sobeca)?.updatedAt, "2026-11-05T03:00:00.000Z");
const afterAssign = listLoadedPitches(assigned.state, sobeca).map((pitch) => pitch.id);
assert.ok(afterAssign.indexOf(INITIAL_MEETING_ID) < afterAssign.indexOf("strategy"));
assert.equal(afterAssign[0], NAFSA_ID);

const filed = applyPitchPatch(
  empty,
  conferencePitch!,
  { category: "  Conference  ", workstream: "Premium 55%" },
  "2026-11-13T00:00:00.000Z"
);
assert.ok(!("error" in filed));
if ("error" in filed) throw new Error("category failed");
assert.equal(filed.pitch.category, "conferences");
assert.equal(filed.pitch.workstream, "premium");
assert.equal(findLoadedPitch(filed.state, CONFERENCE_BELLEVUE_ID, sobeca)?.category, "conferences");
assert.equal(findLoadedPitch(filed.state, CONFERENCE_BELLEVUE_ID, sobeca)?.workstream, "premium");
const clearedCategory = applyPitchPatch(
  filed.state,
  filed.pitch,
  { category: "   ", workstream: "" },
  "2026-11-13T01:00:00.000Z"
);
assert.ok(!("error" in clearedCategory));
if ("error" in clearedCategory) throw new Error("clear category failed");
assert.equal(clearedCategory.pitch.category, null);
assert.equal(clearedCategory.pitch.workstream, null);
const copiedCategory = duplicatePitch(filed.state, filed.pitch, { id: "pitch_cat1", now: "2026-11-13T02:00:00.000Z" });
assert.ok(!("error" in copiedCategory));
if ("error" in copiedCategory) throw new Error("category copy failed");
assert.equal(copiedCategory.pitch.category, "conferences");
assert.equal(copiedCategory.pitch.workstream, "premium");
assert.equal(listLoadedPitches(copiedCategory.state, sobeca)[0]?.id, "pitch_cat1");

const hidden = listLoadedPitches(
  { overrides: { [INITIAL_MEETING_ID]: { live: false, passwordHash: "salt:hash", prompt: "Keep this private." } }, custom: [] },
  { slides: sobecaSlides, passwordHash: "sobeca:hash" }
);
const hiddenMeeting = hidden.find((pitch) => pitch.id === INITIAL_MEETING_ID);
const hiddenSobeca = hidden.find((pitch) => pitch.id === SOBECA_PITCH_ID);
assert.equal(hiddenMeeting?.live, false);
assert.equal(hiddenMeeting?.passwordHash, "salt:hash");
assert.equal(hiddenMeeting?.prompt, "Keep this private.");
assert.equal(hiddenSobeca?.passwordHash, "sobeca:hash");
assert.equal(toAdmin(hiddenSobeca!).protected, true);

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

const conference = findLoadedPitch(empty, CONFERENCE_BELLEVUE_ID, sobeca);
assert.ok(conference);
if (!conference) throw new Error("missing conference pitch");
const conferenceEdited = applyPitchPatch(
  empty,
  conference,
  { slides: conference.slides.slice(0, 1), prompt: "A shorter conference brief." },
  "2026-11-05T09:00:00.000Z"
);
assert.ok(!("error" in conferenceEdited));
if ("error" in conferenceEdited) throw new Error("conference edit failed");
assert.equal(findLoadedPitch(conferenceEdited.state, CONFERENCE_BELLEVUE_ID, sobeca)?.slides.length, 1);
const conferenceReset = applyPitchPatch(conferenceEdited.state, conferenceEdited.pitch, { reset: true }, "2026-11-05T10:00:00.000Z");
assert.ok(!("error" in conferenceReset));
if ("error" in conferenceReset) throw new Error("conference reset failed");
assert.equal(conferenceReset.state.overrides[CONFERENCE_BELLEVUE_ID]?.slides, null);
const conferenceRestored = findLoadedPitch(conferenceReset.state, CONFERENCE_BELLEVUE_ID, sobeca);
assert.equal(conferenceRestored?.slides.length, conferenceBellevueSlides.length);
const anthemHeading = conferenceRestored?.slides[3]?.blocks[0];
assert.equal(anthemHeading && "text" in anthemHeading ? anthemHeading.text : "", "Anthem. Made for your moment.");

const nafsa = findLoadedPitch(empty, NAFSA_ID, sobeca);
assert.ok(nafsa);
if (!nafsa) throw new Error("missing nafsa pitch");
const nafsaEdited = applyPitchPatch(
  empty,
  nafsa,
  { slides: nafsa.slides.slice(0, 1), prompt: "A shorter NAFSA brief." },
  "2026-11-13T03:30:00.000Z"
);
assert.ok(!("error" in nafsaEdited));
if ("error" in nafsaEdited) throw new Error("nafsa edit failed");
assert.equal(findLoadedPitch(nafsaEdited.state, NAFSA_ID, sobeca)?.slides.length, 1);
const nafsaReset = applyPitchPatch(nafsaEdited.state, nafsaEdited.pitch, { reset: true }, "2026-11-13T04:00:00.000Z");
assert.ok(!("error" in nafsaReset));
if ("error" in nafsaReset) throw new Error("nafsa reset failed");
assert.equal(nafsaReset.state.overrides[NAFSA_ID]?.slides, null);
const nafsaRestored = findLoadedPitch(nafsaReset.state, NAFSA_ID, sobeca);
assert.equal(nafsaRestored?.slides.length, nafsaSlides.length);
const nafsaCopy = nafsaRestored?.slides.flatMap((slide) => slide.blocks).map((block) => ("text" in block ? block.text : "")).join("\n");
assert.match(nafsaCopy ?? "", /What future are we ready to create together\?/);
assert.match(nafsaCopy ?? "", /Make the moment undeniable\./);

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

const withVideo = acceptSlides([
  {
    id: "title",
    image: meetingNow.slides[0]!.image,
    imageAlt: meetingNow.slides[0]!.imageAlt,
    video: "https://cdn.example/pitch-loop.mp4",
    blocks: [{ type: "heading", text: "One" }],
  },
]);
assert.equal(withVideo?.[0]?.video, "https://cdn.example/pitch-loop.mp4");
const blankVideo = acceptSlides([
  {
    id: "title",
    image: meetingNow.slides[0]!.image,
    imageAlt: meetingNow.slides[0]!.imageAlt,
    video: "   ",
    blocks: [{ type: "heading", text: "One" }],
  },
]);
assert.equal(blankVideo?.[0]?.video, undefined);
const badVideo = acceptSlides([
  {
    id: "title",
    image: meetingNow.slides[0]!.image,
    imageAlt: meetingNow.slides[0]!.imageAlt,
    video: "javascript:alert(1)",
    blocks: [{ type: "heading", text: "One" }],
  },
]);
assert.equal(badVideo?.[0]?.video, undefined);

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
