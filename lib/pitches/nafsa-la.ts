import type { PitchSlide } from "@/app/sobeca-song-garden/content";
import { libraryPhoto } from "@/lib/pitches/photo-library";

/** Customer-facing Anthem investment pitch for NAFSA Los Angeles 2027. */
export const NAFSA_LA_NAME = "NAFSA LA 2027";

export const NAFSA_LA_PROMPT =
  "NAFSA LA 2027 Anthem pitch. Make Future Ready Together undeniable: the opportunity, the original Anthem experience, the value of participation, and the creative investment, then invite them to book.";

const photo = {
  opportunity: libraryPhoto("conductor"),
  experience: libraryPhoto("anthem"),
  value: libraryPhoto("leaders"),
  investment: libraryPhoto("wide-crowd"),
} as const;

const wash = 0.5;

/** The NAFSA LA 2027 pitch: opportunity, experience, value, and investment. */
export const nafsaLaSlides: PitchSlide[] = [
  {
    id: "opportunity",
    image: photo.opportunity.src,
    imageAlt: photo.opportunity.alt,
    wash,
    blocks: [
      { type: "heading", text: "Make Future Ready Together undeniable." },
      { type: "paragraph", text: "NAFSA 2027 × Crowdsource Choir", bold: true },
      {
        type: "paragraph",
        text: "What if NAFSA didn’t just bring the world together—but gave it an Anthem to sing?",
      },
      {
        type: "paragraph",
        text: "Crowdsource Choir is a participatory entertainment company that transforms audiences into choirs and crowds into the show.",
      },
      {
        type: "paragraph",
        text: "Our signature **Anthem Experience** turns NAFSA’s global community, collective purpose, and conference theme into an original musical experience everyone helps create and perform.",
      },
      {
        type: "paragraph",
        text: "They don’t just hear what Future Ready Together means. They sing it.",
        bold: true,
      },
    ],
  },
  {
    id: "experience",
    image: photo.experience.src,
    imageAlt: photo.experience.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "An original Anthem. Made for NAFSA’s moment." },
      { type: "heading2", text: "1. SOURCE — Invite the world." },
      {
        type: "paragraph",
        text: "A NAFSA-branded digital Song Garden invites attendees to contribute stories, voices, and aspirations before the conference.",
      },
      { type: "heading2", text: "2. CREATE — Compose the Anthem." },
      {
        type: "paragraph",
        text: "We transform those contributions into an original song inspired by NAFSA’s global community and the theme Future Ready Together.",
      },
      { type: "heading2", text: "3. ACTIVATE — World premiere." },
      {
        type: "paragraph",
        text: "A high-energy, facilitated live performance brings thousands of attendees together in one extraordinary collective moment, with musicians and projected lyrics.",
      },
      { type: "heading2", text: "4. EXTEND — Let it live on." },
      {
        type: "paragraph",
        text: "Optional produced music, visuals, and video carry the experience beyond the event.",
      },
      { type: "line", text: "One global community. Thousands of voices. One unforgettable moment." },
    ],
  },
  {
    id: "value",
    image: photo.value.src,
    imageAlt: photo.value.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Participation changes the equation." },
      { type: "heading2", text: "Connection across borders" },
      {
        type: "paragraph",
        text: "Turn strangers from different countries, cultures, and institutions into collaborators through a shared creative experience.",
      },
      { type: "heading2", text: "A theme made tangible" },
      {
        type: "paragraph",
        text: "Bring Future Ready Together to life through something attendees feel, embody, and express together.",
      },
      { type: "heading2", text: "An unforgettable signature moment" },
      {
        type: "paragraph",
        text: "Create an original experience that could only happen with these people, in this place, at this moment.",
      },
      { type: "heading2", text: "A story worth sharing" },
      {
        type: "paragraph",
        text: "Generate a moment of collective joy, with opportunities to extend its impact through original creative content.",
      },
      { type: "line", text: "Ideal for an experiential keynote or closing celebration." },
    ],
  },
  {
    id: "investment",
    image: photo.investment.src,
    imageAlt: photo.investment.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "An original experience. An undeniable moment." },
      { type: "heading2", text: "$15,000–$30,000" },
      {
        type: "paragraph",
        text: "Typical creative investment for a Signature Anthem Experience.",
        bold: true,
      },
      { type: "heading3", text: "Included" },
      {
        type: "list",
        items: [
          "NAFSA-branded digital Song Garden and pre-event community invitation.",
          "Original Anthem composition inspired by community contributions.",
          "Live, facilitated world premiere with musicians and lyric projection.",
          "Creative planning and collaboration with NAFSA’s programming and production teams.",
        ],
      },
      { type: "heading3", text: "Optional enhancements" },
      {
        type: "paragraph",
        text: "Professionally produced song, custom visual media, and edited event video.",
      },
      {
        type: "paragraph",
        text: "Final investment depends on creative scope, scale, and production requirements. Travel and accommodations are additional.",
      },
      {
        type: "line",
        text: "Let’s make Future Ready Together something the world can feel—and sing.",
      },
      { type: "paragraph", text: "Crowdsource Choir | crowdsourcechoir.com/book | sing@crowdsourcechoir.com" },
    ],
  },
];
