import type { PitchSlide } from "@/app/sobeca-song-garden/content";
import { libraryPhoto } from "@/lib/pitches/photo-library";

/** Customer-facing conference pitch introduced by Visit Bellevue. */
export const CONFERENCE_BELLEVUE_NAME = "Conference Pitch: Bellevue";

export const CONFERENCE_BELLEVUE_PROMPT =
  "Conference pitch for gatherings in Bellevue, introduced by Visit Bellevue. Make the next conference undeniable: a signature Anthem Experience that turns attendees into the choir. Walk from the promise through creative potential, participation, the Anthem, the process, the possibilities, and the value, then invite them to book.";

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

/** The Bellevue conference pitch, told from promise to invitation. */
export const conferenceBellevueSlides: PitchSlide[] = [
  {
    id: "promise",
    image: photo.promise.src,
    imageAlt: photo.promise.alt,
    wash,
    blocks: [
      { type: "heading", text: "Make your next conference undeniable." },
      {
        type: "paragraph",
        text: "Crowdsource Choir is a participatory entertainment company.",
        bold: true,
      },
      {
        type: "paragraph",
        text: "Our signature Anthem Experience transforms your conference’s people, purpose, and theme into an original musical experience everyone helps create and perform.",
      },
      { type: "line", text: "Audiences become choirs. Crowds become the show." },
      { type: "kicker", text: "A signature entertainment opportunity for conferences in Bellevue." },
    ],
  },
  {
    id: "potential",
    image: photo.potential.src,
    imageAlt: photo.potential.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Your audience is untapped creative potential." },
      { type: "paragraph", text: "Every attendee brings a distinct voice, story, and perspective." },
      {
        type: "paragraph",
        text: "Together, they create a gathering that could only happen with these people, in this place, at this moment.",
      },
      { type: "line", text: "Something magical happens when we welcome those voices into harmony." },
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
        type: "line",
        text: "Your audience doesn’t just experience the show. They become essential to creating it.",
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
      { type: "heading", text: "Anthem. Made for your moment." },
      {
        type: "paragraph",
        text: "Our signature Anthem Experience transforms your conference’s people, purpose, and theme into an original song—created specifically for your gathering.",
      },
      {
        type: "paragraph",
        text: "Then we bring it to life in a high-energy, participatory world premiere where your attendees become the choir and the crowd becomes the show.",
      },
      { type: "paragraph", text: "No auditions. No sheet music. No musical experience required." },
      { type: "line", text: "They don’t just hear your message. They sing it." },
    ],
  },
  {
    id: "process",
    image: photo.process.src,
    imageAlt: photo.process.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "From untapped potential to collective expression." },
      { type: "heading2", text: "1. SOURCE — Invite your people." },
      {
        type: "paragraph",
        text: "A conference-branded digital Song Garden gathers stories, voices, and reflections from attendees before the event.",
      },
      { type: "heading2", text: "2. CREATE — Compose your Anthem." },
      {
        type: "paragraph",
        text: "We transform those contributions into an original song that expresses the voice, spirit, and purpose of your gathering.",
      },
      { type: "heading2", text: "3. ACTIVATE — World premiere." },
      {
        type: "paragraph",
        text: "Through music, projected lyrics, and high-energy facilitation, your audience brings its Anthem to life together.",
      },
      { type: "heading2", text: "4. EXTEND — Let it live on." },
      {
        type: "paragraph",
        text: "Optional produced music, visuals, and video create shareable content that carries the experience beyond the conference.",
      },
      { type: "line", text: "The experience begins before the event and can live on long after." },
    ],
  },
  {
    id: "possibilities",
    image: photo.possibilities.src,
    imageAlt: photo.possibilities.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "One signature experience. Many ways to make your moment undeniable." },
      { type: "heading2", text: "Opening Ceremonies" },
      {
        type: "paragraph",
        text: "Launch your gathering with an electrifying shared experience that brings your conference theme to life.",
      },
      { type: "heading2", text: "Experiential Keynote" },
      {
        type: "paragraph",
        text: "Transform your central message into something attendees experience, embody, and express together.",
      },
      { type: "heading2", text: "Closing Celebration" },
      {
        type: "paragraph",
        text: "Turn the ideas, inspiration, and relationships of your conference into one unforgettable collective moment.",
      },
      { type: "heading2", text: "Galas & Special Events" },
      { type: "paragraph", text: "Celebrate milestones, communities, and shared achievements with an original Anthem." },
      { type: "line", text: "Built around your audience, your agenda, and your moment." },
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
      { type: "heading2", text: "Deeper connection" },
      {
        type: "paragraph",
        text: "Strangers become collaborators through the shared experience of creating and performing together.",
      },
      { type: "heading2", text: "A message made their own" },
      {
        type: "paragraph",
        text: "Attendees don’t just hear your conference’s purpose. They give it their own voice.",
      },
      { type: "heading2", text: "A signature moment" },
      { type: "paragraph", text: "An original experience that could only happen at your gathering." },
      { type: "heading2", text: "Stories worth sharing" },
      {
        type: "paragraph",
        text: "Memorable moments of joy and creative content that extend your conference’s reach beyond the room.",
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
      { type: "heading", text: "Bring your people together in Bellevue. Give them something to sing together." },
      {
        type: "paragraph",
        text: "Whether you’re exploring Bellevue as your next conference destination or already planning your event here, Crowdsource Choir can help create a signature moment that belongs entirely to your gathering.",
      },
      { type: "line", text: "Your people. Your purpose. Your Anthem." },
      { type: "paragraph", text: "Let’s make the moment undeniable." },
      { type: "paragraph", text: "Crowdsource Choir", bold: true },
      { type: "paragraph", text: "www.crowdsourcechoir.com/book" },
      { type: "paragraph", text: "sing@crowdsourcechoir.com" },
      { type: "kicker", text: "Introduced by Visit Bellevue" },
    ],
  },
];
