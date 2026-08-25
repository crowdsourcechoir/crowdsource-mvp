/**
 * Voice for Learfield — they sell multimedia rights, sponsor activations, and campus products
 * into universities. Pitch is "you take this to your schools," not "book us for one game."
 * Do NOT embed the Gmail signature — clients append it.
 */

export const LEARFIELD_SUBJECT = "A game-day moment and Chant Garden Learfield could take to campuses";

const SHARED_OPENING = `I’m Joel DeJong, founder of Crowdsource Choir here in Seattle. We design and deliver participatory music experiences, custom anthems, and crowdsourced chants — the kind of thing that turns a crowd from spectators into the choir.

Learfield already sits between universities, fans, and sponsors. Two things I think you could sell into your campus partners:

A participatory game-day moment — fans help create an original anthem or chant and bring it to life in the stadium, not just watch it.

A Chant Garden for sponsors — a season-long pipeline of crowdsourced chants and sounds that gives a sponsor a living activation fans actually help make, instead of another static read.

The throughline is simple: the energy is already on campus. We help universities and their sponsors harness it.`;

const SHARED_CLOSE = `There’s a little more about Crowdsource Choir here: www.crowdsourcechoir.com/book

Best,
Joel`;

export type LearfieldDoorway = "sports_properties" | "partnerships" | "brand" | "strategy" | "executive";

export function classifyLearfieldDoorway(roleTitle: string | null | undefined): LearfieldDoorway {
  const title = (roleTitle ?? "").toLowerCase();
  if (/sports properties|multimedia/.test(title)) return "sports_properties";
  if (/partnership/.test(title)) return "partnerships";
  if (/chief strategy|strategy officer/.test(title)) return "strategy";
  if (/brand|marketing/.test(title)) return "brand";
  if (/chief executive|^ceo\b|president and ceo/.test(title)) return "executive";
  if (/president/.test(title)) return "sports_properties";
  return "partnerships";
}

export function learfieldDoorwayAsk(doorway: LearfieldDoorway): string {
  switch (doorway) {
    case "sports_properties":
      return `Given your seat over sports properties and the university relationships, I’d love to connect and explore whether this belongs in what Learfield takes to campuses — a game-day participation product and a sponsor-ready Chant Garden. If someone else owns new campus products, I’d really appreciate being pointed there.`;
    case "partnerships":
      return `Given your work in partnership management, I’m especially interested in the Chant Garden as something Learfield could package for sponsors and take into universities — a living activation fans help create, not another static read.\n\nI’d love to connect, share what we’re building, and explore whether there’s a fit.`;
    case "brand":
      return `Given your work connecting collegiate brands with fans, I’d love to explore how a participatory game-day moment and a season-long Chant Garden could become something Learfield sells into universities and their sponsors — fans helping create the sound, not just consuming it.`;
    case "strategy":
      return `Given your strategy seat, I’d love to connect and see whether a participatory game-day product plus a sponsor Chant Garden belongs in Learfield’s campus offering — or whether you can point me to whoever owns new products for universities.`;
    case "executive":
    default:
      return `I’d love to connect, share what we’re building, and explore whether Learfield would take this to universities — or be pointed to whoever owns new campus products and sponsor activations.`;
  }
}

export function buildLearfieldEmail(input: {
  firstName: string;
  roleTitle?: string | null;
  doorway?: LearfieldDoorway;
}): { subject: string; body: string } {
  const doorway = input.doorway ?? classifyLearfieldDoorway(input.roleTitle);
  const body = `Hi ${input.firstName},\n\n${SHARED_OPENING}\n\n${learfieldDoorwayAsk(doorway)}\n\n${SHARED_CLOSE}`;
  return { subject: LEARFIELD_SUBJECT, body };
}

export function isLearfieldOrgName(name: string | null | undefined): boolean {
  return /learfield/i.test(name ?? "");
}
