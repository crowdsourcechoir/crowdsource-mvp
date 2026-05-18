export type CrowdsourceMarketingAgentInput = {
  eventName: string;
  date: string;
  venue: string;
  theme: string;
  audience: string;
  assets: string;
};

export type CampaignOutput = {
  launchEmail: {
    subject: string;
    preview: string;
    body: string;
  };
  reminderEmail: {
    subject: string;
    preview: string;
    body: string;
  };
  socialCaptions: string[];
  reelIdeas: string[];
  adCopy: string[];
  teaserConcepts: string[];
  postingSchedule: Array<{
    timing: string;
    action: string;
  }>;
  eventPageCopy: {
    headline: string;
    body: string;
    cta: string;
  };
};

export const crowdsourceMarketingAgent = {
  name: "Crowdsource Choir Marketing + Participation Agent",
  shortName: "Brand Brain",
  purpose:
    "Build a centralized AI-assisted creative operations system where marketing becomes participation before the event begins.",
  strategicInsight:
    "Move from Ad -> Ticket -> Attend to Signal -> Contribution -> Belonging -> Anticipation -> Participation -> Artifact -> Ongoing Culture.",
  operatingPrinciples: [
    "Marketing should invite contribution, not just attention.",
    "Every campaign should create emotional investment before arrival.",
    "Audience input can become source material for songs, visuals, teasers, and artifacts.",
    "Reusable systems should free Joel for music craft, immersive development, leadership, and relationships.",
    "The shared core should stay unified before public and private engines fork.",
  ],
  brandVoice: {
    mission:
      "Crowdsource Choir turns audiences into co-creators of participatory musical experiences.",
    tone: "participatory, emotional, communal, artistic, clear, and invitational",
    usePhrases: [
      "help make the anthem",
      "add your voice before the room gathers",
      "your words can become part of the song",
      "a shared musical experience built from the people in the room",
      "participatory cultural creation",
    ],
    avoidPhrases: [
      "passive audience",
      "generic concert promotion",
      "submit content",
      "user-generated content farm",
      "automated marketing blast",
    ],
  },
  audiences: [
    "public attendees",
    "music lovers",
    "wellness and community seekers",
    "immersive arts audiences",
    "conference planners",
    "corporate retreat organizers",
    "nonprofits and fundraisers",
    "arts institutions",
    "sponsors and collaborators",
  ],
  songGarden: {
    philosophy:
      "The Song Garden is a participatory cultural contribution layer, not a generic content submission form.",
    contributionTypes: [
      "phrases",
      "voice notes",
      "visuals",
      "emotional prompts",
      "ambient sounds",
      "harmonic and vocal textures",
    ],
    creativeUses: [
      "anthem creation",
      "looping and sampling",
      "projection visuals",
      "teaser content",
      "social storytelling",
      "immersive show material",
    ],
  },
  recommendedStack: {
    coreAgentLayer: ["Cursor", "Claude/OpenAI APIs"],
    designCreative: ["Adobe Express"],
    websiteEventLayer: ["Squarespace", "Luma"],
    email: ["Mailchimp"],
    automation: ["n8n"],
    backendData: ["Supabase"],
    musicIntegration: ["Ableton Live", "MPC Live 2"],
  },
};

const fallbackInput: CrowdsourceMarketingAgentInput = {
  eventName: "Crowdsource Choir",
  date: "soon",
  venue: "the room",
  theme: "belonging through shared song",
  audience: "people who want to help create the experience",
  assets: "event footage, audience reactions, music clips, testimonials",
};

function clean(value: string, fallback: string): string {
  const next = value.trim();
  return next.length > 0 ? next : fallback;
}

function normalizeInput(input: CrowdsourceMarketingAgentInput): CrowdsourceMarketingAgentInput {
  return {
    eventName: clean(input.eventName, fallbackInput.eventName),
    date: clean(input.date, fallbackInput.date),
    venue: clean(input.venue, fallbackInput.venue),
    theme: clean(input.theme, fallbackInput.theme),
    audience: clean(input.audience, fallbackInput.audience),
    assets: clean(input.assets, fallbackInput.assets),
  };
}

export function buildCrowdsourceCampaign(input: CrowdsourceMarketingAgentInput): CampaignOutput {
  const event = normalizeInput(input);
  const participationPrompt = `Before ${event.eventName}, share a phrase, voice note, image, or sound connected to ${event.theme}. Your contribution may help shape the room, the visuals, or the anthem itself.`;

  return {
    launchEmail: {
      subject: `Help create ${event.eventName}`,
      preview: `Your words and voice can become part of the experience at ${event.venue}.`,
      body: [
        `Something different is happening at ${event.venue} on ${event.date}.`,
        "",
        `${event.eventName} is not a show you only attend. It is a participatory choir experience built from the people who gather for it.`,
        "",
        `The theme is ${event.theme}. Before the event, we are opening a Song Garden: a simple place to contribute a phrase, a voice note, an image, or a sound that carries what this theme means to you.`,
        "",
        "Your contribution may become part of the anthem, the projections, the room energy, or the story we share before the night begins.",
        "",
        "Come ready to listen, sing, shape, and belong.",
      ].join("\n"),
    },
    reminderEmail: {
      subject: `${event.eventName} is getting closer`,
      preview: "Add one small piece of yourself before we gather.",
      body: [
        `${event.eventName} is coming up on ${event.date} at ${event.venue}.`,
        "",
        "If you have not added to the Song Garden yet, this is the moment.",
        "",
        participationPrompt,
        "",
        `This is how anticipation begins: one signal, one contribution, one person realizing they are already part of the piece.`,
      ].join("\n"),
    },
    socialCaptions: [
      `${event.eventName} begins before the doors open. Add a phrase, voice note, image, or sound connected to ${event.theme}. Your contribution may become part of the anthem.`,
      `This is not a passive concert. ${event.eventName} turns ${event.audience} into co-creators of the night.`,
      `Signal -> contribution -> belonging -> song. Join us at ${event.venue} on ${event.date}.`,
      `The Song Garden is open. Share what ${event.theme} sounds, feels, or looks like to you.`,
    ],
    reelIdeas: [
      `Fast montage from ${event.assets}, ending with the prompt: "What should this anthem carry?"`,
      `Joel on camera inviting one short contribution tied to ${event.theme}, then cutting to rehearsal or crowd footage.`,
      `Text-led reel: "Marketing becomes participation" -> "Your words become source material" -> "${event.eventName}".`,
      `Before/after reel showing a submitted phrase becoming a sung hook, loop, projection, or room cue.`,
    ],
    adCopy: [
      `A choir experience built from the audience in the room. Join ${event.eventName} at ${event.venue} on ${event.date}.`,
      `Your voice can shape the anthem before the night begins. Add to the Song Garden, then come sing it into the room.`,
      `For ${event.audience}: a participatory musical experience around ${event.theme}.`,
    ],
    teaserConcepts: [
      "Open with one audience phrase as text on screen, then reveal the phrase being sung.",
      "Show anonymous Song Garden contributions as a growing field of words, colors, and sound fragments.",
      "Release a short countdown where each post invites one contribution type: phrase, voice, image, sound.",
      "Turn a testimonial into a participation prompt: not 'come watch,' but 'come help make this.'",
    ],
    postingSchedule: [
      { timing: "Launch", action: "Announce the event and open the Song Garden with one clear prompt." },
      { timing: "10-14 days out", action: "Share a teaser from existing assets and ask for phrases tied to the theme." },
      { timing: "7 days out", action: "Send reminder email and post a reel showing how contributions become source material." },
      { timing: "3 days out", action: "Publish countdown captions focused on belonging, anticipation, and contribution." },
      { timing: "Day after", action: "Post a recap artifact that credits the room as co-creator and invites continued culture." },
    ],
    eventPageCopy: {
      headline: `Help create ${event.eventName}`,
      body: `${event.eventName} is a participatory musical experience at ${event.venue} on ${event.date}. Add your voice before you arrive: share a phrase, voice note, visual, or sound connected to ${event.theme}. Your contribution can become part of the music, visuals, and shared story of the night.`,
      cta: "Enter the Song Garden",
    },
  };
}
