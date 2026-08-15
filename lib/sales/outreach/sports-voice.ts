/**
 * Voice + draft structure from Joel’s real Seahawks outreach (Aug 2026).
 * Do NOT embed the Gmail signature — clients append it.
 * Never use for tylerc@ (hard-blocked).
 */

export const SEAHAWKS_SUBJECT = "Crowdsourcing a Seahawks Choir";

const SHARED_OPENING = `I’m Joel DeJong, founder of Crowdsource Choir here in Seattle. I’ve been a 12 for many years, and I’ve been thinking about how our work could create a new kind of connection between the team and the 12s.

We design and deliver participatory music experiences, custom anthems, and crowdsourced chants to create energy, resonance, and cohesion within groups.

With the Seahawks, I see a few connected possibilities:

A participatory music experience with the team at training camp to create energy and cohesion before a practice
An original anthem created with the 12s and brought to life in the stadium as a game-day moment
A season-long pipeline of crowdsourced chants and sounds that gives fans new ways to contribute throughout the season

The throughline is simple: there’s enormous collective energy and creative potential already present in the Seahawks community. We help harness it into super fun, engaging musical experiences.`;

const SHARED_CLOSE = `There’s a little more about Crowdsource Choir here: www.crowdsourcechoir.com/book

Best,
Joel`;

export type SportsDoorway =
  | "coo"
  | "operations"
  | "entertainment"
  | "marketing_lead"
  | "marketing"
  | "front_office";

export function classifySportsDoorway(roleTitle: string | null | undefined): SportsDoorway {
  const title = (roleTitle ?? "").toLowerCase();
  if (/coo|chief operating/.test(title)) return "coo";
  if (/operations|reports to coo/.test(title)) return "operations";
  if (/game entertainment|special events|entertainment experience|programming/.test(title)) {
    return "entertainment";
  }
  if (/managing director of marketing|vp.*marketing|vice president.*marketing/.test(title)) {
    return "marketing_lead";
  }
  if (/marketing/.test(title)) return "marketing";
  return "front_office";
}

/** Role-specific ask — matches Joel’s Lee / Allison / Dan / David closers. */
export function sportsDoorwayAsk(doorway: SportsDoorway): string {
  switch (doorway) {
    case "coo":
      return `I’d love to connect, share what we’re building, and see whether there’s a place to explore this with the Seahawks. If someone else on the team is the right person to talk with about this, I’d really appreciate being pointed in their direction.`;
    case "operations":
      return `Given your seat near club operations, I’d love to connect and see whether this belongs somewhere in the Seahawks world — or whether you can point me to the right person across entertainment and marketing.`;
    case "entertainment":
      return `Given your work in entertainment experience and programming, I’d love to connect and explore how this kind of participation could become part of the Seahawks experience—not just something fans watch, but something they help create.`;
    case "marketing_lead":
      return `Given your work leading marketing, I’m especially interested in the potential for this to extend beyond a single game-day moment into something the 12s help create and build throughout the season. I’d love to connect, share what we’re building, and explore whether there’s a fit with the Seahawks.`;
    case "marketing":
      return `Given your work in marketing, I’m especially interested in how this could become a season-long fan participation story—something the 12s actively help create with the team, rather than another campaign directed at them.

I’d love to connect, share what we’re building, and explore whether there’s a fit with the Seahawks.`;
    case "front_office":
    default:
      return `I’d love to connect, share what we’re building, and explore whether there’s a fit with the Seahawks — or be pointed to the right person if that’s someone else on the team.`;
  }
}

export function buildSeahawksEmail(input: {
  firstName: string;
  roleTitle?: string | null;
  doorway?: SportsDoorway;
}): { subject: string; body: string } {
  const doorway = input.doorway ?? classifySportsDoorway(input.roleTitle);
  const body = `Hi ${input.firstName},\n\n${SHARED_OPENING}\n\n${sportsDoorwayAsk(doorway)}\n\n${SHARED_CLOSE}`;
  return { subject: SEAHAWKS_SUBJECT, body };
}

/** Concrete voice examples for LLM few-shots (sports / fan-culture). */
export const SPORTS_VOICE_REFERENCE_EMAILS = `--- SPORTS EXAMPLE 1 (COO / routing) ---
Subject: Crowdsourcing a Seahawks Choir

Hi David,

I’m Joel DeJong, founder of Crowdsource Choir here in Seattle. I’ve been a 12 for many years, and I’ve been thinking about how our work could create a new kind of connection between the team and the 12s.

We design and deliver participatory music experiences, custom anthems, and crowdsourced chants to create energy, resonance, and cohesion within groups. With the Seahawks, I see a few connected possibilities:

A participatory music experience with the team at training camp to create energy and cohesion before a practice
An original anthem created with the 12s and brought to life in the stadium as a game-day moment
A season-long pipeline of crowdsourced chants and sounds that gives fans new ways to contribute throughout the season
The throughline is simple: there’s enormous collective energy and creative potential already present in the Seahawks community. We help harness it into super fun, engaging musical experiences.

I’d love to connect, share what we’re building, and see whether there’s a place to explore this with the Seahawks. If someone else on the team is the right person to talk with about this, I’d really appreciate being pointed in their direction.

There’s a little more about Crowdsource Choir here: www.crowdsourcechoir.com/book

Best,
Joel

--- SPORTS EXAMPLE 2 (entertainment experience) ---
Subject: Crowdsourcing a Seahawks Choir

Hi Lee,

I’m Joel DeJong, founder of Crowdsource Choir here in Seattle. I’ve been a 12 for many years, and I’ve been thinking about how our work could create a new kind of connection between the team and the 12s.

We design and deliver participatory music experiences, custom anthems, and crowdsourced chants to create energy, resonance, and cohesion within groups.

With the Seahawks, I see a few connected possibilities:

A participatory music experience with the team at training camp to create energy and cohesion before a practice
An original anthem created with the 12s and brought to life in the stadium as a game-day moment
A season-long pipeline of crowdsourced chants and sounds that gives fans new ways to contribute throughout the season

The throughline is simple: there’s enormous collective energy and creative potential already present in the Seahawks community. We help harness it into super fun, engaging musical experiences.

Given your work in entertainment experience and programming, I’d love to connect and explore how this kind of participation could become part of the Seahawks experience—not just something fans watch, but something they help create.

There’s a little more about Crowdsource Choir here: www.crowdsourcechoir.com/book

Best,
Joel

--- SPORTS EXAMPLE 3 (marketing lead) ---
Subject: Crowdsourcing a Seahawks Choir

Hi Allison,

I’m Joel DeJong, founder of Crowdsource Choir here in Seattle. I’ve been a 12 for many years, and I’ve been thinking about how our work could create a new kind of connection between the team and the 12s.

We design and deliver participatory music experiences, custom anthems, and crowdsourced chants to create energy, resonance, and cohesion within groups.

With the Seahawks, I see a few connected possibilities:

A participatory music experience with the team at training camp to create energy and cohesion before a practice
An original anthem created with the 12s and brought to life in the stadium as a game-day moment
A season-long pipeline of crowdsourced chants and sounds that gives fans new ways to contribute throughout the season

The throughline is simple: there’s enormous collective energy and creative potential already present in the Seahawks community. We help harness it into super fun, engaging musical experiences.

Given your work leading marketing, I’m especially interested in the potential for this to extend beyond a single game-day moment into something the 12s help create and build throughout the season. I’d love to connect, share what we’re building, and explore whether there’s a fit with the Seahawks.

There’s a little more about Crowdsource Choir here: www.crowdsourcechoir.com/book

Best,
Joel`;
