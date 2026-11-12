import type { PitchSlide } from "@/app/sobeca-song-garden/content";
import { libraryPhoto } from "@/lib/pitches/photo-library";

/** Internal name for the 2027–2028 strategy deck. */
export const STRATEGY_NAME = "Strategy";

export const STRATEGY_PROMPT =
  "2027–2028 internal strategy. Walk from the company we are building, through the two models and four engines, to how the work fits together, what we say yes to, and the next two years.";

const photo = {
  title: libraryPhoto("conductor"),
  company: libraryPhoto("wide-crowd"),
  star: libraryPhoto("arms-wide"),
  frame: libraryPhoto("circle"),
  models: libraryPhoto("leaders"),
  engines: libraryPhoto("balcony"),
  anthem: libraryPhoto("anthem"),
  rave: libraryPhoto("band"),
  chant: libraryPhoto("audience"),
  garden: libraryPhoto("piano"),
  together: libraryPhoto("hands"),
  scale: libraryPhoto("leaders-side"),
  filter: libraryPhoto("pointing"),
  partners: libraryPhoto("drums"),
  close: libraryPhoto("wide-crowd"),
} as const;

const wash = 0.5;

/** The strategy poster, told as a deck. One idea on each slide. */
export const strategySlides: PitchSlide[] = [
  {
    id: "title",
    image: photo.title.src,
    imageAlt: photo.title.alt,
    wash,
    blocks: [
      { type: "kicker", text: "2027–2028" },
      { type: "title", text: "Strategy" },
      { type: "line", text: "A participatory entertainment company." },
    ],
  },
  {
    id: "company",
    image: photo.company.src,
    imageAlt: photo.company.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "We turn audiences into creators." },
      {
        type: "paragraph",
        text: "Crowdsource Choir accelerates and amplifies collective creativity, and cultivates the conditions for collective effervescence to emerge.",
      },
      {
        type: "paragraph",
        text: "The company we are building is lean and profitable. Premium engagements generate cash. Partnerships finance owned entertainment properties, commissioned activations, and assets we can use again.",
      },
    ],
  },
  {
    id: "north-star",
    image: photo.star.src,
    imageAlt: photo.star.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "kicker", text: "North star" },
      { type: "heading", text: "Coherence. Flow. Flourishing." },
      { type: "line", text: "Coherence is the core." },
      { type: "line", text: "Flow is the movement." },
      { type: "line", text: "Flourishing is the outcome." },
      {
        type: "paragraph",
        text: "A financially flourishing company, with recurring revenue, owned intellectual property, powerful partnerships, and cultural impact we can measure.",
      },
    ],
  },
  {
    id: "frame",
    image: photo.frame.src,
    imageAlt: photo.frame.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Four parts of the same frame." },
      {
        type: "table",
        headers: ["Part", "What it holds"],
        rows: [
          ["Culture", "A more connected, creative, flourishing world."],
          ["Ecosystem", "Conferences, sports, brands, education, venues, organizations, communities, and civic groups."],
          ["Crowdsource Choir", "Our methodology, the experiences, the intellectual property, and the partnerships."],
          ["People, purpose, and value", "Communities contribute. Creative expression emerges. Lasting value is created and shared."],
        ],
      },
    ],
  },
  {
    id: "models",
    image: photo.models.src,
    imageAlt: photo.models.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Two ways the company makes work." },
      {
        type: "table",
        headers: ["Model", "What it is"],
        rows: [
          [
            "Premium commissioned experiences",
            "Organizations hire Crowdsource Choir to create a participatory experience for their people, their purpose, and their place.",
          ],
          [
            "Owned entertainment properties",
            "We develop, own, and distribute formats that audiences, venues, sponsors, and presenting partners can activate.",
          ],
        ],
      },
      { type: "line", text: "Commissions fund the company. Owned properties are what the company keeps." },
    ],
  },
  {
    id: "engines",
    image: photo.engines.src,
    imageAlt: photo.engines.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Four engines. One methodology." },
      {
        type: "table",
        headers: ["Engine", "Role"],
        rows: [
          ["Anthem", "Primary cash engine. Premium commissioned experiences."],
          ["Rave Choir", "Owned entertainment and intellectual property."],
          ["Fan Chant", "Sports growth. Spectators become participants."],
          ["Song Garden", "Activation. A garden that can bloom into something larger."],
        ],
      },
    ],
  },
  {
    id: "anthem",
    image: photo.anthem.src,
    imageAlt: photo.anthem.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "kicker", text: "Anthem" },
      { type: "heading", text: "The cash engine is already here." },
      {
        type: "paragraph",
        text: "Premium, commissioned, large-scale original anthem experiences. This is the commercial base.",
      },
      {
        type: "paragraph",
        text: "Revenue comes from engagement fees, higher-value packages, repeat clients, white-label partnerships, and workshops.",
      },
      {
        type: "line",
        text: "The next two years: more premium Anthems, a sales motion we can repeat, and a few larger rooms.",
      },
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
      { type: "heading", text: "An owned night people can return to." },
      {
        type: "paragraph",
        text: "A multigenerational dance-and-sing property that Crowdsource Choir produces and owns.",
      },
      {
        type: "paragraph",
        text: "Revenue can come from tickets, sponsorship, merchandise, licensing, and media. The portfolio can grow: The Rave Choir, The Rave, Kids, and Sports.",
      },
      {
        type: "line",
        text: "The next two years: prove the show, make it repeatable, and open a path to licensing.",
      },
    ],
  },
  {
    id: "fan-chant",
    image: photo.chant.src,
    imageAlt: photo.chant.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "kicker", text: "Fan Chant" },
      { type: "heading", text: "Turn a crowd of spectators into the show." },
      {
        type: "paragraph",
        text: "Original chants, rituals, and participatory fan experiences. The people in the stands stop watching and start making the moment.",
      },
      {
        type: "paragraph",
        text: "Revenue can come from teams and leagues, sponsorship, events, licensing, and digital content.",
      },
      {
        type: "line",
        text: "The next two years: pilots with sports partners, one repeatable activation, and a case study.",
      },
    ],
  },
  {
    id: "song-garden",
    image: photo.garden.src,
    imageAlt: photo.garden.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "kicker", text: "Song Garden" },
      { type: "heading", text: "A garden that can bloom into an anthem." },
      {
        type: "paragraph",
        text: "A creative garden for a school, a district, a community, an institution, or a destination. It continues from contribution into an anthem, an event, or a larger expression.",
      },
      {
        type: "paragraph",
        text: "Revenue comes from commissioned gardens, multi-event and civic partnerships, workshops, education, licensing, and destinations.",
      },
      {
        type: "line",
        text: "The next two years: a few high-impact gardens, documented, on infrastructure we can run again. Seasonal and cultural journeys come after that.",
      },
    ],
  },
  {
    id: "together",
    image: photo.together.src,
    imageAlt: photo.together.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Every engine runs the same loop." },
      {
        type: "table",
        headers: ["Step", "What happens"],
        rows: [
          ["Source", "Communities, organizations, and creative potential."],
          ["Create", "Original music, chants, rituals, and Song Gardens."],
          ["Activate", "Live participatory experiences. Anthem and Rave Choir."],
          ["Capture", "Film, music, stories, and case studies."],
          ["Amplify", "Distribution, and value for partners."],
          ["Repeat and grow", "More opportunities, stronger partnerships, owned assets."],
        ],
      },
    ],
  },
  {
    id: "scale",
    image: photo.scale.src,
    imageAlt: photo.scale.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Cash now. Owned work as we grow." },
      {
        type: "table",
        headers: ["When", "What carries the company"],
        rows: [
          ["Now", "Premium revenue. Anthem fees, commissioned Song Gardens, selected repeat clients."],
          ["Next", "Partner-funded growth. Larger Anthems, a sponsored Rave Choir, the first Fan Chant pilots, more Song Gardens."],
          ["2028 and after", "Recurring revenue and owned intellectual property. Annual partnerships, licensing, Fan Chant programs, Song Garden journeys."],
          ["Longer term", "Distribution we can scale. Licensed participatory properties, media, destinations, and a network of presenting partners."],
        ],
      },
    ],
  },
  {
    id: "filter",
    image: photo.filter.src,
    imageAlt: photo.filter.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Three tests before we say yes." },
      {
        type: "table",
        headers: ["Test", "The question"],
        rows: [
          ["Creative potential", "Will this produce something meaningful for collective creativity and participation?"],
          ["Financial viability", "Is there a real source of revenue, and a path to something we can repeat?"],
          ["Quality of partnership", "Are the people aligned, capable, and ready to collaborate?"],
        ],
      },
      { type: "line", text: "Take work that passes at least two. Prefer work that passes all three." },
    ],
  },
  {
    id: "partners",
    image: photo.partners.src,
    imageAlt: photo.partners.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "The work needs four kinds of partners." },
      {
        type: "table",
        headers: ["Role", "Who"],
        rows: [
          ["Distribution", "Event planners, speaker bureaus, venues, presenters."],
          ["Funding", "Sponsors, institutions, brands, civic and community clients."],
          ["Creative", "Musicians, visual artists, choreographers, technologists."],
          ["Production", "Venues, event producers, technical partners, hospitality."],
        ],
      },
    ],
  },
  {
    id: "priorities",
    image: photo.scale.src,
    imageAlt: photo.scale.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "kicker", text: "Next 12–24 months" },
      { type: "heading", text: "Five things, in this order." },
      {
        type: "list",
        items: [
          "Strengthen Anthem. Higher prices, more repeat clients, less time on leads that do not fit.",
          "Launch Rave Choir with its first pilots.",
          "Turn Fan Chant from pilots into a sports offer we can run again.",
          "Deliver commissioned Song Gardens with a clear budget and a clear partner.",
          "Build the shared engine: the methodology, the sales motion, the production system, and a partnership pipeline.",
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
      { type: "kicker", text: "North star" },
      { type: "heading", text: "Coherence is the core." },
      { type: "line", text: "Flow is the movement." },
      { type: "line", text: "Flourishing is the outcome." },
    ],
  },
];
