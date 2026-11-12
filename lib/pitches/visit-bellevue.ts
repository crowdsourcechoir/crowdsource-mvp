import type { PitchSlide } from "@/app/sobeca-song-garden/content";
import { libraryPhoto } from "@/lib/pitches/photo-library";

/** Customer-facing partnership pitch for Visit Bellevue. */
export const VISIT_BELLEVUE_NAME = "Visit Bellevue";

export const VISIT_BELLEVUE_PROMPT =
  "Partnership pitch for Visit Bellevue. The promise of undeniable experiences: visitors become creators, audiences become choirs, and crowds become the show. A signature Anthem, partnered gatherings, and original entertainment, from one moment toward a world of possibilities.";

const photo = {
  promise: libraryPhoto("conductor"),
  opportunity: libraryPhoto("balcony"),
  potential: libraryPhoto("hands"),
  experience: libraryPhoto("anthem"),
  process: libraryPhoto("piano"),
  partners: libraryPhoto("circle"),
  entertainment: libraryPhoto("band"),
  value: libraryPhoto("leaders"),
  invitation: libraryPhoto("wide-crowd"),
} as const;

const wash = 0.5;

/** The Visit Bellevue partnership, told from promise to invitation. */
export const visitBellevueSlides: PitchSlide[] = [
  {
    id: "promise",
    image: photo.promise.src,
    imageAlt: photo.promise.alt,
    wash,
    blocks: [
      { type: "heading", text: "Create Bellevue’s most undeniable experiences." },
      { type: "paragraph", text: "Crowdsource Choir is a participatory entertainment company." },
      { type: "line", text: "Visitors become creators. Audiences become choirs. Crowds become the show." },
      {
        type: "paragraph",
        text: "We accelerate and amplify collective creativity, cultivating the conditions for collective effervescence to emerge.",
      },
      {
        type: "paragraph",
        text: "Collective effervescence: A shared sense of energy, harmony, and transcendence that emerges when people come together through a common purpose, ritual, or experience.",
      },
      { type: "kicker", text: "Visit Bellevue × Crowdsource Choir" },
    ],
  },
  {
    id: "opportunity",
    image: photo.opportunity.src,
    imageAlt: photo.opportunity.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Invite visitors into Bellevue’s story." },
      {
        type: "paragraph",
        text: "A destination can be more than a place people visit. It’s a story they can become part of.",
      },
      {
        type: "paragraph",
        text: "Through fun, engaging participation, visitors become real-life characters in Bellevue’s unfolding story, helping co-create its next chapter.",
      },
      { type: "line", text: "Not just a place to visit. A story to write." },
    ],
  },
  {
    id: "potential",
    image: photo.potential.src,
    imageAlt: photo.potential.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Every audience is untapped creative potential." },
      { type: "paragraph", text: "Every person brings a distinct voice, story, and perspective." },
      {
        type: "paragraph",
        text: "Together, they form a one-of-a-kind gathering, unique to these people, this place, and this moment.",
      },
      { type: "line", text: "Something magical happens when we welcome those voices into harmony." },
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
        text: "Our signature Anthem Experience transforms the people, purpose, and place behind a gathering into an original song—created specifically for that moment and the people who make it meaningful.",
      },
      {
        type: "paragraph",
        text: "Then we bring it to life in a high-energy, participatory world premiere where the audience becomes the choir and the crowd becomes the show.",
      },
      { type: "line", text: "They don’t just hear what the moment means. They sing it." },
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
      { type: "heading2", text: "1. Source — Invite participation." },
      {
        type: "paragraph",
        text: "A branded digital Song Garden gathers stories, reflections, and inspiration from the people who make the experience meaningful.",
      },
      { type: "heading2", text: "2. Create — Compose the Anthem." },
      {
        type: "paragraph",
        text: "We transform those contributions into an original Anthem that authentically expresses the voice, spirit, and purpose of the gathering.",
      },
      { type: "heading2", text: "3. Activate — Bring it to life." },
      {
        type: "paragraph",
        text: "A wildly fun, facilitated world premiere turns the entire audience into a choir. No musical experience required.",
      },
      { type: "heading2", text: "4. Extend — Let it live on." },
      {
        type: "paragraph",
        text: "Optional produced music, visuals, and video create shareable content that carries the experience beyond the event.",
      },
    ],
  },
  {
    id: "partners",
    image: photo.partners.src,
    imageAlt: photo.partners.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Make their moment undeniable." },
      {
        type: "paragraph",
        text: "We collaborate with event organizers, venues, brands, and community partners to create original experiences inspired by their people, purpose, and place.",
      },
      { type: "heading2", text: "Festivals & Community Celebrations" },
      {
        type: "paragraph",
        text: "Signature Anthems that bring local traditions, stories, and communities to life.",
      },
      { type: "heading2", text: "Meetings & Conventions" },
      {
        type: "paragraph",
        text: "Event-branded Anthems that transform conference themes into high-energy collective experiences.",
      },
      { type: "heading2", text: "Venues, Brands & Cultural Partners" },
      {
        type: "paragraph",
        text: "Custom songs, chants, and musical activations that bring audiences into the story.",
      },
      { type: "line", text: "Every gathering has its own story. We give people a way to sing it together." },
    ],
  },
  {
    id: "entertainment",
    image: photo.entertainment.src,
    imageAlt: photo.entertainment.alt,
    wash,
    reveal: "steps",
    blocks: [
      { type: "heading", text: "Original entertainment. Endless possibilities." },
      {
        type: "paragraph",
        text: "Crowdsource Choir creates all-ages, multigenerational entertainment that can bloom across Bellevue’s venues, neighborhoods, and seasons.",
      },
      { type: "heading2", text: "A Thriller Night" },
      {
        type: "paragraph",
        text: "A Halloween-inspired musical celebration where the crowd becomes the cast.",
      },
      { type: "heading2", text: "Solstice Celebrations" },
      { type: "paragraph", text: "Seasonal gatherings of music, light, and collective celebration." },
      { type: "heading2", text: "Rowdy Holiday Singalong" },
      {
        type: "paragraph",
        text: "Holiday classics and modern hits, reimagined as one big multigenerational party.",
      },
      { type: "heading2", text: "Songs of Soul" },
      {
        type: "paragraph",
        text: "A Black History Month celebration honoring the legacy of Black musical artists.",
      },
      { type: "heading2", text: "Rave Choir" },
      {
        type: "paragraph",
        text: "A high-energy dance party where generations sing harmonies together over massive beats.",
      },
      {
        type: "paragraph",
        text: "Original entertainment with the potential to grow through ticketing, sponsorships, venue partnerships, and recurring events.",
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
      { type: "heading2", text: "Destination distinction" },
      {
        type: "paragraph",
        text: "Original, participatory entertainment that helps Bellevue stand apart.",
      },
      { type: "heading2", text: "Community connection" },
      {
        type: "paragraph",
        text: "Visitors, residents, and local partners become active contributors to shared experiences.",
      },
      { type: "heading2", text: "Stories worth sharing" },
      {
        type: "paragraph",
        text: "Memorable moments of joy and original creative content that inspire word of mouth and extend the reach of each event.",
      },
      { type: "heading2", text: "Long-term potential" },
      {
        type: "paragraph",
        text: "A creative partnership spanning events, venues, conventions, sponsors, and destination initiatives.",
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
        text: "What if Bellevue became a place where visitors don’t just experience the story—but help create it?",
      },
      {
        type: "paragraph",
        text: "Let’s explore opportunities to bring original, participatory entertainment to Bellevue—from our signature Anthem Experience for gatherings to recurring, multigenerational entertainment developed with local venues, sponsors, and community partners.",
      },
      { type: "line", text: "Start with one moment. Cultivate a world of possibilities." },
      { type: "kicker", text: "Crowdsource Choir × Visit Bellevue" },
    ],
  },
];
