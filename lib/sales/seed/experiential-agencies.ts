import type { SeedOrgWithContactsInput } from "@/lib/sales/seed/seed-org-with-contacts";

/**
 * Experiential / brand-experience agencies that can place Crowdsource Choir
 * into conferences, corporate events, sponsor activations, and fan moments.
 * Contacts are published doorways only (Hunter Domain Search / Verifier quota
 * exhausted for this billing period — 2026-11-06).
 *
 * GPJ / George P. Johnson is intentionally omitted — already seeded in
 * ENTERTAINMENT_BOOKING_AGENCIES_SEEDS.
 */
export const EXPERIENTIAL_AGENCIES_SEEDS: SeedOrgWithContactsInput[] = [
  {
    name: "SHW",
    websiteUrl: "https://shworldwide.com",
    locationCity: "Seattle",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "event_agency",
    salesInitiative: "booking_agents",
    opportunityTypeKey: "other",
    forceManualQueue: true,
    runPipeline: false,
    manualEventName: "Conference / corporate experiential — Crowdsource Choir",
    manualQueueTitle: "SHW (Seattle) — premium experiential-agency outreach",
    manualQueueDescription:
      "Seattle full-service event & experiential agency (conferences, brand activations, corporate meetings). Strong local partner for conference openings/closings and employee gatherings — pitch Crowdsource as participatory shared-creation entertainment.",
    contacts: [
      {
        fullName: "Brett Robertson",
        email: "brettr@shworldwide.com",
        roleTitle: "Partner & CEO",
        roleCategory: "executive",
        emailVerificationStatus: "valid_format",
        roleDescription:
          "Published PNDC sponsorship contact — CEO doorway for new experiential partnerships.",
      },
      {
        fullName: "SHW Info Desk",
        email: "info@shworldwide.com",
        roleTitle: "General Inquiries",
        roleCategory: "sales",
        emailVerificationStatus: "valid_format",
        roleDescription: "Published general inbox on shworldwide.com.",
      },
    ],
  },
  {
    name: "Sparks",
    websiteUrl: "https://www.wearesparks.com",
    locationCity: "Philadelphia",
    locationRegion: "PA",
    locationCountry: "US",
    organizationTypeKey: "event_agency",
    salesInitiative: "booking_agents",
    opportunityTypeKey: "other",
    forceManualQueue: true,
    runPipeline: false,
    manualEventName: "Brand experience / corporate event — Crowdsource Choir",
    manualQueueTitle: "Sparks (Freeman) — premium experiential-agency outreach",
    manualQueueDescription:
      "Global brand-experience agency (part of The Freeman Company): corporate events, exhibits, activations. Pitch Crowdsource into established corporate event programs with substantial production resources.",
    contacts: [
      {
        fullName: "Wes Vanasek",
        email: "wes.vanasek@wearesparks.com",
        roleTitle: "Sr. Director, Business Development",
        roleCategory: "sales",
        emailVerificationStatus: "valid_format",
        roleDescription:
          "Published BD contact (LinkedIn) — doorway for new brand-experience partnerships.",
      },
      {
        fullName: "Bryan Shapiro",
        email: "bryan.shapiro@wearesparks.com",
        roleTitle: "Senior Communications Manager",
        roleCategory: "marketing",
        emailVerificationStatus: "valid_format",
        roleDescription: "Published Freeman/Sparks press contact — useful router into growth team.",
      },
      {
        fullName: "Sparks Hello Desk",
        email: "hello@wearesparks.com",
        roleTitle: "General Inquiries",
        roleCategory: "sales",
        emailVerificationStatus: "valid_format",
        roleDescription: "Published general inbox for Sparks brand experience.",
      },
    ],
  },
  {
    name: "INVNT",
    websiteUrl: "https://invnt.com",
    locationCity: "New York",
    locationRegion: "NY",
    locationCountry: "US",
    organizationTypeKey: "event_agency",
    salesInitiative: "booking_agents",
    opportunityTypeKey: "other",
    forceManualQueue: true,
    runPipeline: false,
    manualEventName: "Brand storytelling live experience — Crowdsource Choir",
    manualQueueTitle: "INVNT — premium experiential-agency outreach",
    manualQueueDescription:
      "Global brand storytelling through live events, digital experiences, and activations. Strong conceptual fit for turning audience contributions into an original shared musical experience.",
    contacts: [
      {
        fullName: "INVNT Hello Desk",
        email: "hello@invnt.com",
        roleTitle: "Supplier / Partner Inquiries",
        roleCategory: "sales",
        emailVerificationStatus: "valid_format",
        roleDescription:
          "Published supplier/partner + project inquiry mailbox on invnt.com/contact.",
      },
    ],
  },
  {
    name: "NVE Experience Agency",
    websiteUrl: "https://experiencenve.com",
    locationCity: "Los Angeles",
    locationRegion: "CA",
    locationCountry: "US",
    organizationTypeKey: "event_agency",
    salesInitiative: "booking_agents",
    opportunityTypeKey: "other",
    forceManualQueue: true,
    runPipeline: false,
    manualEventName: "Culture / sports brand experience — Crowdsource Choir",
    manualQueueTitle: "NVE Experience Agency — premium experiential-agency outreach",
    manualQueueDescription:
      "Culture-led brand experience agency with a sports marketing practice. Prospect for mainstream music, fan participation, and sponsored community experiences — pitch Crowdsource as participatory entertainment.",
    contacts: [
      {
        fullName: "NVE Hello Desk",
        email: "hello@experiencenve.com",
        roleTitle: "General Inquiries",
        roleCategory: "sales",
        emailVerificationStatus: "valid_format",
        roleDescription: "Published general inbox for NVE Experience Agency.",
      },
    ],
  },
  {
    name: "Infinity Marketing Team",
    websiteUrl: "https://www.infinitymarketing.com",
    locationCity: "Culver City",
    locationRegion: "CA",
    locationCountry: "US",
    organizationTypeKey: "event_agency",
    salesInitiative: "booking_agents",
    opportunityTypeKey: "other",
    forceManualQueue: true,
    runPipeline: false,
    manualEventName: "Experiential brand activation — Crowdsource Choir",
    manualQueueTitle: "Infinity Marketing Team — premium experiential-agency outreach",
    manualQueueDescription:
      "Experiential marketing and event production (gaming, tech, sports, culture). Pitch custom musical activations within broader brand campaigns.",
    contacts: [
      {
        fullName: "Trevor Mills",
        email: "trevor@infinitymarketing.com",
        roleTitle: "Director of Innovation",
        roleCategory: "executive",
        emailVerificationStatus: "valid_format",
        roleDescription:
          "Published Event Marketer It List contact — innovation / new-work doorway.",
      },
      {
        fullName: "Infinity Hello Desk",
        email: "hello@infinitymarketing.com",
        roleTitle: "General Inquiries",
        roleCategory: "sales",
        emailVerificationStatus: "valid_format",
        roleDescription: "Published general inbox on infinitymarketing.com/contact.",
      },
    ],
  },
  {
    name: "Swell",
    websiteUrl: "https://www.we-are-swell.com",
    locationCity: "New York",
    locationRegion: "NY",
    locationCountry: "US",
    organizationTypeKey: "event_agency",
    salesInitiative: "booking_agents",
    opportunityTypeKey: "other",
    forceManualQueue: true,
    runPipeline: false,
    manualEventName: "Festival / sports brand experience — Crowdsource Choir",
    manualQueueTitle: "Swell — premium experiential-agency outreach",
    manualQueueDescription:
      "Independent experiential agency specializing in music festivals, pop-ups, product launches, and major sporting events. Particularly relevant to sponsor-funded public participation and fan experiences.",
    contacts: [
      {
        fullName: "Tomos Evans",
        email: "tom@we-are-swell.com",
        roleTitle: "Co-Founder",
        roleCategory: "executive",
        emailVerificationStatus: "valid_format",
        roleDescription: "Published contact on we-are-swell.com/contact and BizBash directory.",
      },
    ],
  },
];

/** Requested in the same batch but already present via entertainment booking agencies seed. */
export const EXPERIENTIAL_AGENCIES_ALREADY_SEEDED = [
  {
    name: "George P. Johnson",
    websiteUrl: "https://www.gpj.com",
    reason: "Already in ENTERTAINMENT_BOOKING_AGENCIES_SEEDS / production Booking agents queue.",
  },
] as const;
