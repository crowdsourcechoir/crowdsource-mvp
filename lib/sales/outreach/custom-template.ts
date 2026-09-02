import { classifyOutreachPersona, PERSONA_STRATEGIES } from "@/lib/sales/outreach/persona";
import { classifyQueueCategory, type QueueCategoryKey } from "@/lib/sales/queue/category";
import { classifySportsDoorway, sportsDoorwayAsk } from "@/lib/sales/outreach/sports-voice";

function eventLabel(opportunityTitle: string, organizationName: string): string {
  const stripped = opportunityTitle
    .replace(/^.*participatory anthem for\s+/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
  if (stripped && stripped.length < 80 && !/^crowdsource choir/i.test(stripped)) return stripped;
  return organizationName;
}

function conferenceAsk(roleTitle: string | null, event: string): string {
  const persona = classifyOutreachPersona(roleTitle);
  const title = (roleTitle ?? "").trim();
  if (title && /event|marketing|program|conference|meeting|experience/i.test(title)) {
    return `Given your work as ${title}, I'd love to connect and see whether this belongs in the ${event} program — or whether you can point me to whoever owns that.`;
  }
  return PERSONA_STRATEGIES[persona].cta.replace(/\.$/, "") + ` for ${event}.`;
}

function sportsPossibilities(organizationName: string, isCollege: boolean): string[] {
  const fans = isCollege ? "students and fans" : "fans";
  const venue = isCollege ? "in the arena" : "on game day";
  return [
    `A participatory music experience with the team${isCollege ? " or student-athletes" : ""} to create energy and cohesion`,
    `An original anthem created with ${fans} and brought to life ${venue}`,
    `A season-long pipeline of crowdsourced chants and sounds that gives people new ways to contribute`,
  ];
}

function conferencePossibilities(event: string): string[] {
  return [
    `A shared anthem created with attendees so the ${event} message is something they perform, not only hear`,
    `A participatory moment in a general session that turns the room into one choir`,
    `A piece people can keep after they leave — something that belongs to this community, not a one-off soundtrack`,
  ];
}

function artsPossibilities(organizationName: string): string[] {
  return [
    `A participatory work created with your audience so they help make the piece, not only receive it`,
    `An original anthem or sung moment that belongs to ${organizationName} and the people in the room`,
    `A format that can return season after season as a living tradition`,
  ];
}

function techPossibilities(event: string): string[] {
  return [
    `A participatory anthem built with attendees during ${event}, so the gathering has a moment they made together`,
    `A live singing experience that cuts through the usual keynote pattern without feeling like entertainment-for-hire`,
    `A shared piece that can live on after the conference — in chapters, meetups, or next year's room`,
  ];
}

function fundraiserPossibilities(organizationName: string): string[] {
  return [
    `A participatory anthem the room creates and sings together as the emotional center of the night`,
    `A moment donors actually make, instead of another program they sit through`,
    `A piece ${organizationName} can bring back year after year`,
  ];
}

export function buildCustomizedTemplateDraft(input: {
  firstName: string;
  roleTitle?: string | null;
  organizationName: string;
  opportunityTitle: string;
  category?: string | null;
}): { subject: string; body: string } {
  const first = input.firstName.trim() || "there";
  const org = input.organizationName.trim();
  const event = eventLabel(input.opportunityTitle, org);
  const category =
    (input.category as QueueCategoryKey | undefined) ||
    classifyQueueCategory({
      organizationName: org,
      opportunityTitle: input.opportunityTitle,
    });

  const isSeahawks = /seahawks/i.test(org);
  const isCollege = /university|athletics|college|state\b/i.test(`${org} ${input.opportunityTitle}`);

  let subject: string;
  let intro: string;
  let possibilities: string[];
  let throughline: string;
  let ask: string;

  if (category === "sports") {
    subject = isCollege ? `Turn ${org.replace(/\s+Athletics$/i, "")} fans into the game-day show` : `Crowdsourcing a ${org} choir`;
    intro = isSeahawks
      ? `I'm Joel DeJong, founder of Crowdsource Choir here in Seattle. I've been a 12 for many years, and I've been thinking about how our work could create a new kind of connection between the team and the 12s.\n\nWe design and deliver participatory music experiences, custom anthems, and crowdsourced chants to create energy, resonance, and cohesion within groups.`
      : `I'm Joel DeJong, founder of Crowdsource Choir here in Seattle. We design and deliver participatory music experiences, custom anthems, and crowdsourced chants to create energy, resonance, and cohesion within groups.`;
    possibilities = sportsPossibilities(org, isCollege);
    throughline = `The throughline is simple: there's already enormous collective energy in the ${org} community. We help harness it into super fun, engaging musical experiences.`;
    ask = isSeahawks
      ? sportsDoorwayAsk(classifySportsDoorway(input.roleTitle))
      : `I'd love to connect, share what we're building, and explore whether there's a fit with ${org} — or be pointed to the right person if that's someone else.`;
  } else if (category === "tech") {
    subject = `Crowdsource Choir + ${event}`;
    intro = `I'm Joel DeJong, founder of Crowdsource Choir — a participatory musical experience where the people in the room become the choir.\n\nI wanted to reach out because I think this could be a natural fit for ${event}.`;
    possibilities = techPossibilities(event);
    throughline = `The throughline is simple: ${event} already gathers people who build things together. This is that instinct, sung.`;
    ask = conferenceAsk(input.roleTitle ?? null, event);
  } else if (category === "arts" || category === "entertainment") {
    subject = `Crowdsource Choir + ${org}`;
    intro = `I'm Joel DeJong, founder of Crowdsource Choir. We create participatory music experiences where the audience helps write and then perform an original piece together.`;
    possibilities = artsPossibilities(org);
    throughline = `The throughline is simple: ${org} already knows how to move a room. We help the room make something of its own.`;
    ask = `I'd love to connect and explore whether this belongs in your season — or be pointed to whoever programs live experience.`;
  } else if (category === "fundraisers") {
    subject = `Crowdsource Choir + ${org}`;
    intro = `I'm Joel DeJong, founder of Crowdsource Choir. We create participatory anthems with the people in the room, so a fundraising night has a moment they actually make together.`;
    possibilities = fundraiserPossibilities(org);
    throughline = `The throughline is simple: the generosity is already in the room. We give it a voice people can sing.`;
    ask = conferenceAsk(input.roleTitle ?? null, org);
  } else {
    subject = `Crowdsource Choir + ${event}`;
    intro = `I'm Joel DeJong, founder of Crowdsource Choir.\n\nWe create participatory music experiences where attendees co-create and sing an original anthem, so the gathering's message is something they perform together.`;
    possibilities = conferencePossibilities(event);
    throughline = `The throughline is simple: ${org} already brings this community together. We help turn that into a musical experience they make — not another session they sit through.`;
    ask = conferenceAsk(input.roleTitle ?? null, event);
  }

  const body = [
    `Hi ${first},`,
    "",
    intro,
    "",
    `With ${event}, I see a few connected possibilities:`,
    "",
    possibilities.join("\n"),
    "",
    throughline,
    "",
    ask,
    "",
    `There's a little more about Crowdsource Choir here: www.crowdsourcechoir.com/book`,
    "",
    "Best,",
    "Joel",
  ].join("\n");

  return { subject, body };
}
