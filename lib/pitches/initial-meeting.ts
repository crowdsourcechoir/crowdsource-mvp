import type { PitchSlide } from "@/app/sobeca-song-garden/content";

/** Internal name for the Anthem Experience meeting deck. */
export const INITIAL_MEETING_NAME = "Initial Meeting Deck";

export const INITIAL_MEETING_PROMPT =
  "Initial meeting deck. Make the moment undeniable: participatory entertainment that turns audiences into the show. Walk a partner from the idea through before, during, and after, what an Anthem Experience includes, where it fits, and a starting investment of $15,000.";

const photo = {
  title: "/pitch/initial-meeting/live-title.jpg",
  audience: "/pitch/initial-meeting/live-audience.jpg",
  instruments: "/pitch/initial-meeting/live-instruments.jpg",
  participation: "/pitch/initial-meeting/live-participation.jpg",
  lasts: "/pitch/initial-meeting/live-lasts.jpg",
  withYou: "/pitch/initial-meeting/live-with-you.jpg",
  places: "/pitch/initial-meeting/live-places.jpg",
  show: "/pitch/initial-meeting/live-show.jpg",
} as const;

/** Full-bleed sections in the same shape as the SoBECA Song Garden page. */
export const initialMeetingSlides: PitchSlide[] = [
  {
    id: "title",
    image: photo.title,
    imageAlt: "A conductor with arms raised as a room of people sings",
    wash: 0.22,
    blocks: [
      { type: "title", text: "Make the moment undeniable.", underline: "undeniable" },
      { type: "kicker", text: "Anthem Experience" },
      {
        type: "paragraph",
        text: "Participatory entertainment that turns audiences into the show. Crowdsource Choir transforms your people, purpose, and message into an original musical experience that everyone helps create.",
      },
      { type: "line", text: "They don't just hear the point. They sing it." },
    ],
  },
  {
    id: "audience",
    image: photo.audience,
    imageAlt: "A crowd singing with their hands up",
    wash: 0.4,
    blocks: [
      { type: "heading", text: "Your audience is your greatest untapped creative resource." },
      {
        type: "paragraph",
        text: "Every gathering brings together people with stories, ideas, voices, and energy.",
      },
      { type: "paragraph", text: "Most events are designed to deliver content to those people." },
      { type: "paragraph", text: "What happens when you invite them to create something together?" },
      {
        type: "paragraph",
        text: "You unlock a different level of engagement, connection, and ownership.",
      },
    ],
  },
  {
    id: "instruments",
    image: photo.instruments,
    imageAlt: "Two leaders facing a room of people singing",
    wash: 0.34,
    blocks: [
      { type: "heading", text: "We are the instruments." },
      { type: "paragraph", text: "Every audience holds a field of collective potential." },
      {
        type: "paragraph",
        text: "Through music and participation, Crowdsource Choir awakens and amplifies it—turning individual voices into a shared experience of connection, creativity, and joy.",
      },
      { type: "line", text: "The potential is already in the room — we make it resonate." },
    ],
  },
  {
    id: "participation",
    image: photo.participation,
    imageAlt: "People with their hands up around a singer",
    wash: 0.4,
    blocks: [
      { type: "heading", text: "Participation changes the equation." },
      {
        type: "table",
        headers: ["What changes", "How"],
        rows: [
          [
            "Deeper connection",
            "When we risk, we reap the reward. At Crowdsource Choir, we risk together. By stepping outside our comfort zones—in the context of others—we create something none of us could create alone and share in the reward.",
          ],
          [
            "A message people make their own",
            "Turn your mission, theme, or brand message into something people actively express—not just hear.",
          ],
          [
            "An unforgettable signature moment",
            "Create a shared experience that distinguishes your event and gives people a story worth telling.",
          ],
          [
            "Value beyond the event",
            "Build anticipation before the gathering and create opportunities for continued connection, content, and engagement afterward.",
          ],
        ],
      },
    ],
  },
  {
    id: "arc",
    image: photo.lasts,
    imageAlt: "A full room and a band still on stage",
    wash: 0.36,
    blocks: [
      { type: "heading", text: "The experience begins long before the music—and lasts long after." },
      {
        type: "table",
        headers: ["When", "What happens"],
        rows: [
          [
            "Before",
            "Invite participation. Through a custom-branded Song Garden, participants contribute their stories, ideas, words, and voices.",
          ],
          [
            "During",
            "Create the moment. An original anthem brings those contributions together. A facilitated live performance transforms the audience into the music.",
          ],
          [
            "After",
            "Carry it forward. The shared experience becomes a lasting memory, with optional recordings, video, and other media to extend its reach.",
          ],
        ],
      },
    ],
  },
  {
    id: "with-you",
    image: photo.withYou,
    imageAlt: "A band performing on a small stage",
    wash: 0.28,
    blocks: [
      { type: "heading", text: "Not an off-the-shelf performance." },
      { type: "paragraph", text: "Created with you, for your people." },
      {
        type: "paragraph",
        text: "Every Anthem Experience includes a collaborative creative process:",
      },
      {
        type: "list",
        items: [
          {
            label: "Participation design",
            detail: "Develop a custom-branded Song Garden and engagement strategy with your team.",
          },
          {
            label: "Creative discovery",
            detail: "Explore your purpose, audience, theme, and desired outcomes.",
          },
          {
            label: "Original composition",
            detail: "Transform participant contributions into an original anthem.",
          },
          {
            label: "Experience design",
            detail: "Shape the musical and participatory moments around your event.",
          },
          {
            label: "Live activation",
            detail: "Lead your audience in an accessible, high-energy collective performance.",
          },
        ],
      },
      { type: "line", text: "The live moment is the culmination of the creative work." },
    ],
  },
  {
    id: "places",
    image: photo.places,
    imageAlt: "People gathered in a circle around musicians",
    wash: 0.4,
    blocks: [
      { type: "heading", text: "Designed to move people. Built to advance your goals." },
      {
        type: "table",
        headers: ["Where", "What it does"],
        rows: [
          [
            "Conferences",
            "Turn your conference theme into a shared experience that strengthens connection, brings your message to life, and creates new sponsorship value.",
          ],
          [
            "Fundraisers",
            "Bring your mission to life, deepen donor connection, and build collective energy before the ask.",
          ],
          [
            "Sports",
            "Turn fans into the soundtrack of their team, creating original traditions, deeper loyalty, and new sponsorship opportunities.",
          ],
        ],
      },
    ],
  },
  {
    id: "investment",
    image: photo.show,
    imageAlt: "A leader with arms wide in a room washed in blue and green light",
    wash: 0.34,
    blocks: [
      { type: "heading", text: "More than a performance." },
      { type: "paragraph", text: "A complete audience engagement experience." },
      {
        type: "paragraph",
        text: "The Anthem Experience brings together creative strategy, participant engagement, original music, experience design, and live facilitation.",
      },
      {
        type: "paragraph",
        text: "Each engagement is developed around the audience, objectives, and scale of the opportunity.",
      },
      {
        type: "paragraph",
        text: "Selected community and fundraising partnerships may have different investment structures.",
      },
      {
        type: "line",
        text: "Signature Anthem Experiences typically start at $15,000, with scope and investment tailored to the event.",
      },
    ],
  },
  {
    id: "invitation",
    image: photo.title,
    imageAlt: "A conductor with arms raised as a room of people sings",
    wash: 0.32,
    blocks: [
      { type: "heading", text: "What could we create together?" },
      { type: "paragraph", text: "Every gathering has a message worth sharing." },
      { type: "paragraph", text: "Every audience has a voice worth hearing." },
      { type: "paragraph", text: "Let's create an experience that brings them together." },
      { type: "kicker", text: "Crowdsource Choir" },
      { type: "line", text: "Make the moment undeniable.", underline: "undeniable" },
    ],
  },
];
