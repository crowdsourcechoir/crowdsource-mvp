import type { PitchSlide } from "@/app/sobeca-song-garden/content";
import { libraryPhoto } from "@/lib/pitches/photo-library";

/** Customer-facing Anthem pitch for NAFSA 2027. */
export const NAFSA_NAME = "NAFSA Pitch";

export const NAFSA_PROMPT =
  "NAFSA 2027 Anthem pitch. Make Future Ready Together undeniable: a participatory world premiere that turns international educators into the choir. Walk from the promise through creative potential, participation, the Anthem, the process, the possibilities, and the value, then invite them to book.";

const photo = {
  promise: libraryPhoto("conductor"),
  potential: libraryPhoto("hands"),
  participation: libraryPhoto("audience"),
  experience: libraryPhoto("anthem"),
  process: libraryPhoto("piano"),
  possibilities: libraryPhoto("circle"),
  value: libraryPhoto("leaders"),
  invitation: libraryPhoto("wide-crowd"),
} as const;

const wash = 0.5;

/** The NAFSA 2027 pitch, told from promise to invitation. */
export const nafsaSlides: PitchSlide[] = [
  {
    id: "promise",
    image: photo.promise.src,
    imageAlt: photo.promise.alt,
    wash,
    blocks: [
      { type: "heading", text: "Make Future Ready Together undeniable." },
      {
        type: "paragraph",
        text: "Crowdsource Choir is a participatory entertainment company.",
        bold: true,
      },
      {
        type: "paragraph",
        text: "We turn audiences into choirs, crowds into the show, and conference themes into unforgettable collective experiences.",
      },
      {
        type: "paragraph",
        text: "What if NAFSA didn’t just bring the world together—but gave it an Anthem to sing?",
        bold: true,
      },
      { type: "kicker", text: "NAFSA 2027 × Crowdsource Choir" },
    ],
  },
  {
    id: "potential",
    image: photo.potential.src,
    imageAlt: photo.potential.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "The world is full of untapped creative potential." },
      {
        type: "paragraph",
        text: "NAFSA brings together thousands of international educators, leaders, and changemakers from around the globe.",
      },
      { type: "paragraph", text: "Every person brings a distinct voice, story, and perspective." },
      {
        type: "paragraph",
        text: "Together, they form a gathering that could only happen with these people, in this place, at this moment.",
      },
      { type: "line", text: "Something extraordinary happens when we welcome those voices into harmony." },
    ],
  },
  {
    id: "participation",
    image: photo.participation.src,
    imageAlt: photo.participation.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Participation is the difference." },
      { type: "heading2", text: "Traditional — Observe" },
      { type: "paragraph", text: "The experience happens in front of you." },
      { type: "heading2", text: "Immersive — Enter" },
      { type: "paragraph", text: "The experience happens around you." },
      { type: "heading2", text: "Interactive — Influence" },
      { type: "paragraph", text: "The experience responds to you." },
      { type: "heading2", text: "Participatory — Co-create" },
      { type: "paragraph", text: "Something original emerges because of what we create together." },
      {
        type: "paragraph",
        text: "Participation dissolves the barrier between performer and audience, inviting strangers to become collaborators.",
      },
      { type: "line", text: "We don’t just talk about collaboration. We experience it together." },
    ],
  },
  {
    id: "experience",
    image: photo.experience.src,
    imageAlt: photo.experience.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Anthem. Made for the moment." },
      {
        type: "paragraph",
        text: "Our signature Anthem Experience transforms the people, purpose, and theme of NAFSA 2027 into an original song, created specifically for this gathering.",
      },
      {
        type: "paragraph",
        text: "Then we bring it to life in a high-energy, participatory world premiere where thousands of international educators become the choir and the crowd becomes the show.",
      },
      { type: "paragraph", text: "No auditions. No sheet music. No musical experience required." },
      { type: "line", text: "They don’t just hear what Future Ready Together means. They sing it." },
    ],
  },
  {
    id: "process",
    image: photo.process.src,
    imageAlt: photo.process.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "From global perspectives to collective expression." },
      { type: "heading2", text: "1. SOURCE — Invite the world." },
      {
        type: "paragraph",
        text: "A NAFSA-branded digital Song Garden gathers voices, stories, and aspirations from attendees before the conference.",
      },
      { type: "paragraph", text: "What future are we ready to create together?", bold: true },
      { type: "heading2", text: "2. CREATE — Compose the Anthem." },
      {
        type: "paragraph",
        text: "We transform their contributions into an original Anthem reflecting NAFSA’s theme, its global community, and their shared aspirations for international education.",
      },
      { type: "heading2", text: "3. ACTIVATE — World premiere." },
      {
        type: "paragraph",
        text: "Through live music, projected lyrics, and high-energy facilitation, we invite the entire room to bring the Anthem to life.",
      },
      { type: "heading2", text: "4. EXTEND — Let it live on." },
      {
        type: "paragraph",
        text: "Optional professionally produced music, visuals, and video carry the experience beyond the conference and into NAFSA’s global community.",
      },
      { type: "line", text: "The experience begins before the music—and can resonate long after." },
    ],
  },
  {
    id: "possibilities",
    image: photo.possibilities.src,
    imageAlt: photo.possibilities.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "One Anthem. An unforgettable collective moment." },
      { type: "heading2", text: "Experiential Keynote" },
      {
        type: "paragraph",
        text: "Bring Future Ready Together to life through a high-energy, participatory experience that transforms the conference theme into something attendees can feel, embody, and express together.",
      },
      { type: "heading2", text: "Closing Celebration" },
      {
        type: "paragraph",
        text: "Transform the ideas, relationships, and inspiration of NAFSA 2027 into a joyful world premiere that celebrates the global community and the future they’re creating together.",
      },
      {
        type: "paragraph",
        text: "The Anthem can also anchor an opening ceremony, setting the tone for everything that follows.",
      },
      {
        type: "line",
        text: "However it takes shape, the experience is original to NAFSA and the people gathered there.",
      },
    ],
  },
  {
    id: "value",
    image: photo.value.src,
    imageAlt: photo.value.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Participation creates value beyond the moment." },
      { type: "heading2", text: "Connection across borders" },
      {
        type: "paragraph",
        text: "Invite people from different cultures, countries, and institutions into a shared creative experience.",
      },
      { type: "heading2", text: "A theme made tangible" },
      {
        type: "paragraph",
        text: "Transform Future Ready Together from a conference message into something participants experience firsthand.",
      },
      { type: "heading2", text: "A signature moment" },
      { type: "paragraph", text: "Create an original, unforgettable expression of NAFSA’s global community." },
      { type: "heading2", text: "A story worth sharing" },
      {
        type: "paragraph",
        text: "Give attendees a joyful memory and the opportunity for original creative content that extends the experience worldwide.",
      },
      { type: "line", text: "People remember what they help create." },
    ],
  },
  {
    id: "invitation",
    image: photo.invitation.src,
    imageAlt: photo.invitation.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "What if NAFSA gave the world something to sing together?" },
      { type: "paragraph", text: "Thousands of unique voices. A shared purpose. One extraordinary moment." },
      {
        type: "paragraph",
        text: "Let’s explore creating the NAFSA 2027 Anthem—an original, participatory experience that brings Future Ready Together to life through the very people shaping the future of international education.",
      },
      {
        type: "line",
        text: "The future isn’t something we wait for. It’s something we create together.",
      },
      { type: "kicker", text: "NAFSA 2027 × Crowdsource Choir" },
      { type: "paragraph", text: "Make the moment undeniable.", bold: true },
      { type: "paragraph", text: "www.crowdsourcechoir.com/book" },
      { type: "paragraph", text: "sing@crowdsourcechoir.com" },
    ],
  },
];
