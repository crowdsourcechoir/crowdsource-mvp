import type { SeedOrgWithContactsInput } from "@/lib/sales/seed/seed-org-with-contacts";

/**
 * Eudēmonia Summit and the closest consumer longevity gatherings.
 * Addresses are published (coalition listing or the event's own inbox).
 * None are SMTP-verified: Hunter's search quota was already spent.
 */
export const EUDEMONIA_COMPARABLE_SEEDS: SeedOrgWithContactsInput[] = [
  {
    name: "Eudēmonia Summit",
    websiteUrl: "https://eudemonia.net/",
    locationCity: "West Palm Beach",
    locationRegion: "FL",
    locationCountry: "US",
    organizationTypeKey: "conference",
    salesInitiative: "conferences_associations",
    opportunityTypeKey: "annual_conference",
    forceManualQueue: true,
    runPipeline: false,
    manualEventName: "Eudēmonia Summit 2027",
    manualQueueTitle: "Eudēmonia Summit 2027 — West Palm Beach (Nov 11–14) participatory anthem",
    manualQueueDescription:
      "Fourth annual consumer summit on health, longevity, and flourishing, November 11–14, 2027, West Palm Beach. 2026 drew 10,000 people across 18 venues at the Palm Beach County Convention Center, with 200+ experts, 220+ brands, talks, movement, and live music. Founder and CEO Sean Hoess previously co-founded Wanderlust. Pitch a participatory anthem for the mainstage gathering. sean@eudemonia.net is the address on the Healthspan Action coalition listing. hello@eudemonia.net is the public ticket inbox. Neither address is SMTP-verified. Events lead is Jonnie Halstead, VP Events. Programming lead is Karina Mackenzie, VP Programming.",
    eventDateEstimate: "2027-11-11",
    eventDateConfidence: "confirmed",
    contacts: [
      {
        fullName: "Sean Hoess",
        email: "sean@eudemonia.net",
        roleTitle: "Founder, CEO & Executive Producer",
        roleCategory: "executive",
        emailVerificationStatus: "valid_format",
        roleDescription:
          "Founder and CEO. Address is the one published on the Healthspan Action coalition listing, not an SMTP-verified mailbox.",
      },
      {
        fullName: "Hello inbox",
        email: "hello@eudemonia.net",
        roleTitle: "Published ticket and organizer inbox",
        roleCategory: "events",
        emailVerificationStatus: "valid_format",
        roleDescription:
          "Public inbox printed for ticket holders and listed as the organizer contact. Use this if Sean's published address does not answer.",
      },
    ],
  },
  {
    name: "Health Optimisation Summit",
    websiteUrl: "https://healthoptimisation.com/",
    locationCity: "Austin",
    locationRegion: "TX",
    locationCountry: "US",
    organizationTypeKey: "conference",
    salesInitiative: "conferences_associations",
    opportunityTypeKey: "annual_conference",
    forceManualQueue: true,
    runPipeline: false,
    manualEventName: "Health Optimisation Summit Austin 2027",
    manualQueueTitle: "Health Optimisation Summit 2027 — Austin (Apr 2–4) participatory anthem",
    manualQueueDescription:
      "Closest US comparable to Eudēmonia. Consumer longevity and biohacking summit, April 2–4, 2027, Palmer Events Center, Austin. Founded by Tim Gray. The first Austin edition drew 2,620 people; 2027 is planned for 4,500 attendees, 60+ speakers, and 140+ brands, with workshops. Speaker overlap with Eudēmonia includes Gary Brecka, Vonda Wright, and Max Lugavere. Organizer is Health Optimisation (Summit) Ltd in the UK. London edition is September 10–12, 2027. enquiries@healthoptimisation.com is the published company inbox, not a confirmed personal address.",
    eventDateEstimate: "2027-04-02",
    eventDateConfidence: "confirmed",
    contacts: [
      {
        fullName: "Tim Gray",
        email: "enquiries@healthoptimisation.com",
        roleTitle: "Founder",
        roleCategory: "executive",
        emailVerificationStatus: "valid_format",
        roleDescription:
          "Founder of the Health Optimisation Summit. The email is the published company enquiries inbox, not a confirmed personal address.",
      },
    ],
  },
  {
    name: "The Longevity Show",
    websiteUrl: "https://longevityshow.com/",
    locationCity: "London",
    locationRegion: null,
    locationCountry: "GB",
    organizationTypeKey: "conference",
    salesInitiative: "conferences_associations",
    opportunityTypeKey: "annual_conference",
    forceManualQueue: true,
    runPipeline: false,
    manualEventName: "The Longevity Show 2027",
    manualQueueTitle: "The Longevity Show 2027 — London (Apr 16–17) participatory anthem",
    manualQueueDescription:
      "Closest festival-format comparable to Eudēmonia. April 16–17, 2027, Tobacco Dock, London. Speakers, movement, recovery, and an expo under one roof. The 2026 show had thousands of attendees, about 160 speakers, and 100+ brands. Co-founders are Carolyn Dawson (Founders Forum Group) and Phil Newman (Longevity.Technology). Daniel Burridge is Event Director. theteam@longevityshow.com is the published company inbox.",
    eventDateEstimate: "2027-04-16",
    eventDateConfidence: "confirmed",
    contacts: [
      {
        fullName: "Daniel Burridge",
        email: "theteam@longevityshow.com",
        roleTitle: "Event Director",
        roleCategory: "events",
        emailVerificationStatus: "valid_format",
        roleDescription:
          "Event Director. theteam@longevityshow.com is the published company inbox on the event terms, not a confirmed personal address. Carolyn Dawson and Phil Newman are the co-founders.",
      },
    ],
  },
];
