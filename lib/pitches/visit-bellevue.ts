import type { PitchSlide } from "@/app/sobeca-song-garden/content";
import { libraryPhoto } from "@/lib/pitches/photo-library";

/** Customer-facing partnership pitch for Visit Bellevue. */
export const VISIT_BELLEVUE_NAME = "Visit Bellevue";

export const VISIT_BELLEVUE_PROMPT =
  "Partnership pitch for Visit Bellevue. A short overview of Crowdsource Choir as a participatory entertainment company, with Rave Choir as a city night they can book or refer, in a season like Snowflake Lane.";

const photo = {
  title: libraryPhoto("conductor"),
  feeling: libraryPhoto("wide-crowd"),
  company: libraryPhoto("hands"),
  rave: libraryPhoto("band"),
  partnership: libraryPhoto("leaders"),
  city: libraryPhoto("audience"),
  night: libraryPhoto("drums"),
  close: libraryPhoto("arms-wide"),
} as const;

const wash = 0.48;

/** Outward pitch. One idea on each slide, aimed at a tourism partner. */
export const visitBellevueSlides: PitchSlide[] = [
  {
    id: "title",
    image: photo.title.src,
    imageAlt: photo.title.alt,
    wash,
    blocks: [
      { type: "kicker", text: "Visit Bellevue" },
      { type: "title", text: "Crowdsource Choir" },
      { type: "line", text: "Participatory entertainment for the city." },
    ],
  },
  {
    id: "feeling",
    image: photo.feeling.src,
    imageAlt: photo.feeling.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "The nights people remember are the ones they were in." },
      {
        type: "paragraph",
        text: "A visitor can watch a city go by. The trip they tell a friend about is the one they helped make.",
      },
      { type: "line", text: "We turn a room of people into the show." },
    ],
  },
  {
    id: "company",
    image: photo.company.src,
    imageAlt: photo.company.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "A participatory entertainment company." },
      {
        type: "paragraph",
        text: "Crowdsource Choir writes music with the people in the room. They sing it, they move to it, and they leave having made it together.",
      },
      { type: "line", text: "Bellevue brings the people and the place. We bring the night." },
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
      { type: "heading", text: "A night the whole city can join." },
      {
        type: "paragraph",
        text: "Families, visitors, and locals in one room, dancing and singing together. Multigenerational, and built to happen again.",
      },
      {
        type: "paragraph",
        text: "A holiday edition belongs in a downtown season like Snowflake Lane. Lights outside. A room inside where the city makes the music.",
      },
      { type: "line", text: "The kind of night a city puts on its list." },
    ],
  },
  {
    id: "partnership",
    image: photo.partnership.src,
    imageAlt: photo.partnership.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Book it, or send it on." },
      {
        type: "table",
        headers: ["Door", "What it looks like"],
        rows: [
          ["Book it", "Visit Bellevue presents Rave Choir as a city experience."],
          ["Refer it", "A hotel, venue, brand, or civic partner needs a participatory night. You send them to us."],
        ],
      },
      { type: "line", text: "Either door puts an experience on Bellevue's list." },
    ],
  },
  {
    id: "city",
    image: photo.city.src,
    imageAlt: photo.city.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "A signature night, and the story after it." },
      {
        type: "list",
        items: [
          "A reason to come downtown, not only a place to pass through.",
          "Locals and visitors in the same room.",
          "Film, music, and photos the city can keep using.",
          "A partner when a conference, a district, or a season needs its own moment.",
        ],
      },
    ],
  },
  {
    id: "first-night",
    image: photo.night.src,
    imageAlt: photo.night.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "We start with one night, shaped for Bellevue." },
      {
        type: "list",
        items: [
          "Choose the season and the room.",
          "Shape the music around the city.",
          "Fill it with visitors and locals.",
          "Leave with a story the next partner can feel.",
        ],
      },
    ],
  },
  {
    id: "close",
    image: photo.close.src,
    imageAlt: photo.close.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "kicker", text: "Visit Bellevue" },
      { type: "heading", text: "Let's find Bellevue's night." },
      { type: "line", text: "You already know how this city gathers. We can give them a night they make together." },
    ],
  },
];
