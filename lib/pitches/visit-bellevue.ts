import type { PitchSlide } from "@/app/sobeca-song-garden/content";
import { libraryPhoto } from "@/lib/pitches/photo-library";

/** Customer-facing partnership pitch for Visit Bellevue. */
export const VISIT_BELLEVUE_NAME = "Visit Bellevue";

export const VISIT_BELLEVUE_PROMPT =
  "Partnership pitch for Visit Bellevue. The Crowdsource Choir story: audiences become a choir, the crowd becomes the show, across venues, festivals, activations, districts, and sports. Song Garden and Rave Choir are two ways that practice shows up in a city.";

const photo = {
  title: libraryPhoto("conductor"),
  choir: libraryPhoto("audience"),
  more: libraryPhoto("arms-wide"),
  where: libraryPhoto("balcony"),
  garden: libraryPhoto("piano"),
  rave: libraryPhoto("band"),
  city: libraryPhoto("leaders"),
  close: libraryPhoto("wide-crowd"),
} as const;

const wash = 0.5;

/** The company story, told for a city partner. Confidence before the ask. */
export const visitBellevueSlides: PitchSlide[] = [
  {
    id: "title",
    image: photo.title.src,
    imageAlt: photo.title.alt,
    wash,
    blocks: [
      { type: "kicker", text: "Visit Bellevue" },
      { type: "title", text: "Crowdsource Choir" },
      { type: "line", text: "Participatory entertainment." },
    ],
  },
  {
    id: "choir",
    image: photo.choir.src,
    imageAlt: photo.choir.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "We turn audiences into a choir." },
      {
        type: "paragraph",
        text: "People arrive as a crowd. Someone starts the song. Then the room is the one singing it.",
      },
      { type: "line", text: "The crowd becomes the show." },
    ],
  },
  {
    id: "more",
    image: photo.more.src,
    imageAlt: photo.more.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "More than a performance." },
      {
        type: "paragraph",
        text: "A performance is something a room receives. This is something a room makes.",
      },
      {
        type: "paragraph",
        text: "Crowdsource Choir accelerates and amplifies creativity. We create the conditions for collective effervescence to emerge.",
      },
      { type: "line", text: "What happens could not have happened to any one person alone." },
    ],
  },
  {
    id: "where",
    image: photo.where.src,
    imageAlt: photo.where.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Wherever a crowd can become the work." },
      {
        type: "table",
        headers: ["Where", "What changes"],
        rows: [
          ["Venues", "A room finds one voice."],
          ["Festivals", "Strangers become a choir for a night."],
          ["Activations", "People step into the moment."],
          ["Districts", "A place hears itself."],
          ["Sports", "The stands become part of the play."],
        ],
      },
    ],
  },
  {
    id: "garden",
    image: photo.garden.src,
    imageAlt: photo.garden.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "kicker", text: "Song Garden" },
      { type: "heading", text: "Sometimes the choir begins before anyone gathers." },
      {
        type: "paragraph",
        text: "A school, a district, a community, or a destination offers stories, words, and voices. The garden blooms into the music, and often into the event itself.",
      },
      { type: "line", text: "The place is already in the song." },
    ],
  },
  {
    id: "rave",
    image: photo.rave.src,
    imageAlt: photo.rave.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "kicker", text: "Rave Choir" },
      { type: "heading", text: "A whole city, making one night." },
      {
        type: "paragraph",
        text: "Families, visitors, and locals, dancing and singing together. The same practice, large enough for a downtown season.",
      },
      {
        type: "paragraph",
        text: "In a season like Snowflake Lane, it is the room inside the lights. The part of the visit people are in.",
      },
      { type: "line", text: "The city, singing." },
    ],
  },
  {
    id: "city",
    image: photo.city.src,
    imageAlt: photo.city.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Bellevue already knows how to gather people." },
      {
        type: "paragraph",
        text: "Visit Bellevue stands where those gatherings are chosen. A season. A district. A festival. A venue. A sports night.",
      },
      {
        type: "paragraph",
        text: "Crowdsource Choir can be the night itself. It can also be what a partner uses when they want their people to make something together.",
      },
      { type: "line", text: "The practice travels. The feeling is the same." },
    ],
  },
  {
    id: "close",
    image: photo.close.src,
    imageAlt: photo.close.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "kicker", text: "Crowdsource Choir" },
      { type: "heading", text: "Collective effervescence." },
      { type: "line", text: "Audiences into a choir. The crowd into the show." },
    ],
  },
];
