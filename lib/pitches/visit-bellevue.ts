import type { PitchSlide } from "@/app/sobeca-song-garden/content";
import { libraryPhoto } from "@/lib/pitches/photo-library";

/** Customer-facing partnership pitch for Visit Bellevue. */
export const VISIT_BELLEVUE_NAME = "Visit Bellevue";

export const VISIT_BELLEVUE_PROMPT =
  "Partnership pitch for Visit Bellevue. The promise of talked-about experiences: visitors become participants, audiences become choirs, and crowds become the show. A Song Garden sources an original Anthem, premiered by the room, with ways to live on in events, meetings, and a Bellevue edition of Rave Choir.";

const photo = {
  promise: libraryPhoto("conductor"),
  opportunity: libraryPhoto("balcony"),
  potential: libraryPhoto("hands"),
  experience: libraryPhoto("anthem"),
  process: libraryPhoto("piano"),
  possibilities: libraryPhoto("band"),
  value: libraryPhoto("leaders"),
  invitation: libraryPhoto("wide-crowd"),
} as const;

const wash = 0.5;

/** The Visit Bellevue partnership, told as eight beats from promise to invitation. */
export const visitBellevueSlides: PitchSlide[] = [
  {
    id: "promise",
    image: photo.promise.src,
    imageAlt: photo.promise.alt,
    wash,
    blocks: [
      { type: "kicker", text: "Visit Bellevue × Crowdsource Choir" },
      { type: "heading", text: "Create Bellevue’s most talked-about experiences." },
      {
        type: "paragraph",
        text: "Crowdsource Choir is a participatory entertainment company.",
      },
      {
        type: "line",
        text: "We turn visitors into participants, audiences into choirs, and crowds into the show.",
      },
    ],
  },
  {
    id: "opportunity",
    image: photo.opportunity.src,
    imageAlt: photo.opportunity.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "A destination is more than a place people visit." },
      { type: "line", text: "It’s what they experience together." },
      {
        type: "paragraph",
        text: "Bellevue’s next unforgettable attraction could be something its visitors, residents, and communities create together.",
      },
      { type: "line", text: "Not just something to see. Something to be part of." },
    ],
  },
  {
    id: "potential",
    image: photo.potential.src,
    imageAlt: photo.potential.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Every audience is full of untapped creative potential." },
      {
        type: "paragraph",
        text: "Every visitor, resident, and gathering brings distinct voices, stories, and perspectives.",
      },
      {
        type: "paragraph",
        text: "Together, they represent something no other destination or event can replicate.",
      },
      { type: "line", text: "What if we brought those voices into harmony?" },
    ],
  },
  {
    id: "experience",
    image: photo.experience.src,
    imageAlt: photo.experience.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "We turn crowds into the show." },
      {
        type: "paragraph",
        text: "Crowdsource Choir transforms the people, purpose, and place behind a gathering into an original, event-branded Anthem that everyone helps create and perform.",
      },
      {
        type: "paragraph",
        text: "A high-energy, participatory world premiere where strangers become collaborators and the audience becomes the attraction.",
      },
      { type: "line", text: "They don’t just hear what the gathering stands for. They sing it." },
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
      {
        type: "table",
        headers: ["Step", "What happens"],
        rows: [
          [
            "Source",
            "Invite participation. A branded digital Song Garden gathers stories, reflections, and inspiration from the people who make the experience meaningful.",
          ],
          [
            "Create",
            "Compose the Anthem. We transform those contributions into original songs, anthems, and chants that authentically express the voice, spirit, and purpose of the gathering.",
          ],
          [
            "Activate",
            "Bring it to life. A wildly fun, facilitated world premiere turns the entire audience into a choir. No musical experience required.",
          ],
          [
            "Extend",
            "Let it live on. Optional produced music, visuals, and video create shareable content that carries the experience beyond the event.",
          ],
        ],
      },
    ],
  },
  {
    id: "possibilities",
    image: photo.possibilities.src,
    imageAlt: photo.possibilities.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "One creative engine. Many ways to bring Bellevue to life." },
      {
        type: "table",
        headers: ["Where", "What it becomes"],
        rows: [
          [
            "Signature Events & Celebrations",
            "Create a signature Anthem and unforgettable collective moment for a festival, cultural celebration, or community gathering.",
          ],
          [
            "Meetings & Conventions",
            "Give meeting planners an original, event-branded experience that connects their attendees to each other and to Bellevue.",
          ],
          [
            "Signature Entertainment",
            "Develop sponsorable, recurring entertainment properties—including the potential for a Bellevue edition of Rave Choir—that give people a reason to gather, visit, and return.",
          ],
        ],
      },
      { type: "line", text: "Start with one moment. Build toward something distinctly Bellevue." },
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
      {
        type: "table",
        headers: ["Value", "What it gives Bellevue"],
        rows: [
          ["Destination distinction", "Original, participatory entertainment that helps Bellevue stand apart."],
          ["Community connection", "Visitors, residents, and local partners become active contributors to shared experiences."],
          [
            "Stories worth sharing",
            "Memorable moments and original creative content that inspire word of mouth and extend the reach of each event.",
          ],
          [
            "Long-term potential",
            "A creative partnership spanning events, venues, conventions, sponsors, and destination initiatives.",
          ],
        ],
      },
      { type: "line", text: "Create experiences people don’t just attend. They talk about." },
    ],
  },
  {
    id: "invitation",
    image: photo.invitation.src,
    imageAlt: photo.invitation.alt,
    wash,
    reveal: "steps",
    blocks: [
      {
        type: "heading",
        text: "What if Bellevue’s next great gathering didn’t just bring people together—but gave them something to sing together?",
      },
      {
        type: "paragraph",
        text: "Let’s identify a signature event, conference, or celebration where Crowdsource Choir can create an original, branded Anthem that brings its people, purpose, and place to life.",
      },
      {
        type: "paragraph",
        text: "And explore how participatory entertainment can grow into something uniquely Bellevue.",
      },
      { type: "line", text: "One original experience. A world of possibilities." },
      { type: "kicker", text: "Crowdsource Choir × Visit Bellevue" },
    ],
  },
];
