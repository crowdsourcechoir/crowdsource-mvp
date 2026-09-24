export type PitchSlide = {
  id: string;
  image: string;
  imageAlt: string;
  kicker?: string;
  title?: string;
  paragraphs?: string[];
  columns?: { label: string; body: string }[];
  steps?: string[];
  chips?: string[];
  lists?: { heading: string; items: string[] }[];
  cards?: { label: string; title: string; body: string }[];
  closing?: boolean;
};

/** Verbatim pitch copy from the supplied deck. Do not paraphrase. */
export const slides: PitchSlide[] = [
  {
    id: "title",
    image: "/sobeca-song-garden/sobeca-hero-district.jpg",
    imageAlt: "A walkable creative district street at dusk",
    kicker: "ANTHEM EXPERIENCE",
    title: "Proposal for NPC 2027 in Houston",
    paragraphs: ["SONG GARDEN"],
  },
  {
    id: "experience",
    image: "/sobeca-song-garden/sobeca-hero-voices.jpg",
    imageAlt: "People singing together outdoors",
    kicker: "ANTHEM EXPERIENCE",
    paragraphs: [
      "Crowdsource Choir will create a participatory musical experience that begins before the National Planning Conference in Houston and culminates in an audience choir performing an original anthem, brought to life by the collective voices of the APA community at the closing ceremony keynote.",
    ],
  },
  {
    id: "arc",
    image: "/sobeca-song-garden/sobeca-hero-camp.jpg",
    imageAlt: "A grassy courtyard between low buildings",
    kicker: "ANTHEM EXPERIENCE ARC",
    columns: [
      {
        label: "Before Houston",
        body: "Digital Song Garden opens. APA members contribute words, voices, sounds, stories…the song seeds for the original anthem.",
      },
      {
        label: "Curation and Composing",
        body: "Crowdsource Choir curates and composes the song seeds into original music while designing the live experience that will bring it to life.",
      },
      {
        label: "Closing Ceremony",
        body: "Crowdsource Choir delivers a live performance as an experiential keynote. The APA community becomes the choir culminating in singing the original APA anthem.",
      },
    ],
    steps: ["01 PLANT", "02 GROW", "03 BLOOM"],
  },
  {
    id: "living",
    image: "/sobeca-song-garden/sobeca-hero-garden.jpg",
    imageAlt: "An outdoor listening garden in a courtyard",
    kicker: "SONG GARDEN: A LIVING EXPERIENCE",
    chips: [
      "Physical Song Garden Installation",
      "Conference-Wide Song Garden",
      "Houston Pop-ups & Extensions",
      "Expanded Production + Media",
      "Anthem Release on Global DSPs",
      "Participatory Gaming Journey",
    ],
    paragraphs: [
      "The Song Garden can grow from a participatory anthem keynote into a living experience woven throughout NPC 2027. Physical installations, interactive environments, screens, creative prompts, and experiences across the conference—and potentially Houston—create an always-on canvas where attendees can contribute, discover, respond, and encounter the the evolving collective creation. In addition to the journey toward an anthem experience, the Song Garden becomes part of the conference itself.",
    ],
  },
  {
    id: "investment",
    image: "/sobeca-song-garden/sobeca-hero-night.jpg",
    imageAlt: "An arts district street in the evening",
    kicker: "THE INVESTMENT",
    title: "Starting at $25,000",
    lists: [
      {
        heading: "Includes:",
        items: [
          "Anthem experience strategy + creative direction",
          "Custom NPC 2027 Digital Song Garden",
          "Attendee contribution journey",
          "Curation of community song seeds",
          "Original anthem composition + production",
          "Closing ceremony keynote experience design",
          "Crowdsource Choir live performance",
          "Production planning + conference team integration",
        ],
      },
      {
        heading: "Custom Scope + Investment",
        items: [
          "Living experience strategy + creative direction",
          "Physical Song Garden installations + contribution spaces",
          "Conference-wide screens + interactive environments",
          "Participatory, game-like attendee journey",
          "Evolving visual + creative content",
          "Houston pop-ups + city-wide extensions",
          "Expanded live, visual + media production",
          "Professional capture + anthem release",
        ],
      },
    ],
    cards: [
      {
        label: "SONG GARDEN",
        title: "Anthem Experience",
        body: "A Participatory Closing Ceremony Keynote",
      },
      {
        label: "SONG GARDEN",
        title: "Living Experience",
        body: "A Conference-Wide Interactive Installation",
      },
    ],
  },
  {
    id: "what-if",
    image: "/sobeca-song-garden/sobeca-hero-choir.jpg",
    imageAlt: "A circle of people singing on a lawn",
    title: "WHAT IF NPC 2027 CULTIVATED AN EXPRESSION OF EVERYONE WHO JOURNEYS TO HOUSTON…",
    paragraphs: [
      "…AND BECAME A LIVING CHOIR.",
      "Every individual contribution becomes part of the canvas for a collective musical composition—growing from registration, throughout the conference, and culminating in an original anthem.",
      "Created from everyone. Sung together.",
      "At the closing ceremony keynote.",
    ],
  },
  {
    id: "close",
    image: "/sobeca-song-garden/sobeca-hero-district.jpg",
    imageAlt: "A walkable creative district street at dusk",
    closing: true,
    title:
      "WHAT IF NPC 2027 CULTIVATED A LIVING EXPRESSION OF EVERYONE WHO JOURNEYS TO HOUSTON…",
    paragraphs: [
      "…AND THE PLACES THEY BRING WITH THEM?",
      "EVERY INDIVIDUAL CONTRIBUTION BECOMES PART OF THE CANVAS FOR A COLLECTIVE MUSICAL COMPOSITION—GROWING FROM REGISTRATION, THROUGHOUT THE CONFERENCE, AND CULMINATING IN AN ORIGINAL ANTHEM.",
      "CREATED FROM EVERYONE. SUNG BY EVERYONE.",
      "TOGETHER, AT THE CLOSING CEREMONY KEYNOTE.",
    ],
  },
];
