/**
 * Doorway contacts for World Health Expo (WHX), supplied for the sales queue.
 * Emails are the published addresses only. Enjy El Mokadem has no verified direct
 * email — do not invent one; the congress inbox is a separate team contact.
 */

export const WORLD_HEALTH_EXPO_NAME = "World Health Expo";
export const WORLD_HEALTH_EXPO_WEBSITE = "https://www.worldhealthexpo.com/";

/** Name variants that should receive these contacts instead of a second org. */
export const WORLD_HEALTH_EXPO_NAME_CANDIDATES = [
  "World Health Expo",
  "World Health Expo Dubai",
  "WHX Dubai",
] as const;

export const WORLD_HEALTH_EXPO_QUEUE_TITLE = "World Health Expo — WHX Dubai 2027 participatory anthem";
export const WORLD_HEALTH_EXPO_EVENT_NAME = "WHX Dubai 2027";
export const WORLD_HEALTH_EXPO_EVENT_DATE = "2027-01-25";

export const WORLD_HEALTH_EXPO_QUEUE_DESCRIPTION =
  "WHX Dubai, 25–28 January 2027, at Dubai Exhibition Centre. Pitch a participatory anthem for the congress. Programming doorway is the published congress inbox. Ross Williams is Commercial Director; his published address is a team inbox. Rubina Dsouza and Tom Coleman are Thrive by WHX (Cape Town) brochure contacts — confirm current remit. Enjy El Mokadem is Conference Director for WHX Dubai and has no verified direct email; ask for her through the congress inbox.";

export type WorldHealthExpoContact = {
  fullName: string;
  /** Null when no address was published for this person. */
  email: string | null;
  roleTitle: string;
  roleCategory: string;
  roleDescription: string;
};

export const WORLD_HEALTH_EXPO_CONTACTS: WorldHealthExpoContact[] = [
  {
    fullName: "Enjy El Mokadem",
    email: null,
    roleTitle: "Conference Director, WHX Dubai",
    roleCategory: "events",
    roleDescription:
      "Conference Director, WHX Dubai; publicly credited with leading its conference programming. No verified direct email. Ask for her through the congress inbox congress.whx@informa.com.",
  },
  {
    fullName: "WHX Dubai conference team",
    email: "congress.whx@informa.com",
    roleTitle: "Congress inbox — programming, stages, and congress enquiries",
    roleCategory: "events",
    roleDescription:
      "Official WHX Dubai contact for programming, stages, and congress enquiries. Published inbox congress.whx@informa.com.",
  },
  {
    fullName: "Ross Williams",
    email: "sales.whxdubai@informa.com",
    roleTitle: "Commercial Director, WHX Dubai",
    roleCategory: "commercial",
    roleDescription:
      "Commercial Director, WHX Dubai. sales.whxdubai@informa.com is a team inbox published under his name, not a confirmed personal mailbox.",
  },
  {
    fullName: "Rubina Dsouza",
    email: "rubina.dsouza@informa.com",
    roleTitle: "Conference Director, Thrive by WHX (Cape Town)",
    roleCategory: "events",
    roleDescription:
      "Conference Director, Thrive by WHX, Cape Town, in its 2025 brochure. rubina.dsouza@informa.com is a publicly published direct email; confirm her current remit.",
  },
  {
    fullName: "Tom Coleman",
    email: "tom.coleman@informa.com",
    roleTitle: "Portfolio Director, Thrive by WHX",
    roleCategory: "executive",
    roleDescription:
      "Portfolio Director, Thrive by WHX, in its 2025 brochure. tom.coleman@informa.com is a publicly published direct email; confirm his current remit.",
  },
];
