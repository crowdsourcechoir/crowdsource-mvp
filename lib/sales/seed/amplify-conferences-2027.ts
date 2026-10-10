import type { SeedOrgWithContactsInput } from "@/lib/sales/seed/seed-org-with-contacts";

/**
 * Seven distinct 2027 “Amplify” conferences from Joel’s shortlist.
 * Contacts ranked from Hunter Domain Search / Email Finder (2026-10-10).
 * emailVerificationStatus set when Hunter already returned a status so seed skips a second Verifier pass.
 */
export const AMPLIFY_CONFERENCES_2027_SEEDS: SeedOrgWithContactsInput[] = [
  {
    name: "Amplify A|E|C",
    websiteUrl: "https://www.smps.org",
    locationCity: "Chicago",
    locationRegion: "IL",
    locationCountry: "US",
    organizationTypeKey: "association",
    salesInitiative: "conferences_associations",
    opportunityTypeKey: "annual_conference",
    forceManualQueue: true,
    runPipeline: false,
    manualEventName: "Amplify A|E|C 2027",
    manualQueueTitle: "Amplify A|E|C 2027 — Chicago (Jul 14–16) participatory anthem",
    manualQueueDescription:
      "SMPS Amplify A|E|C — architecture, engineering, construction marketing and leadership (900+ attendees in 2026). Pitch a shared-creation anthem for the AEC marketing community in Chicago.",
    eventDateEstimate: "2027-07-14",
    eventDateConfidence: "confirmed",
    contacts: [
      {
        fullName: "Marci Thompson",
        email: "marci@smps.org",
        roleTitle: "Chief Executive Officer",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        roleDescription:
          "SMPS CEO — owns association priorities and can green-light or route a flagship-conference programming idea.",
      },
      {
        fullName: "Michele Santiago",
        email: "michele@smps.org",
        roleTitle: "Marketing Manager",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        roleDescription:
          "Marketing manager — strong doorway for conference narrative, sponsors, and attendee experience story.",
      },
      {
        fullName: "Devin Stubbs",
        email: "devin@smps.org",
        roleTitle: "Digital Marketing Manager",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        roleDescription:
          "Digital marketing — useful for how a live participatory moment extends into pre/post conference content.",
      },
    ],
  },
  {
    name: "Amplify Informatics",
    websiteUrl: "https://amia.org",
    locationCity: "Atlanta",
    locationRegion: "GA",
    locationCountry: "US",
    organizationTypeKey: "association",
    salesInitiative: "conferences_associations",
    opportunityTypeKey: "annual_conference",
    forceManualQueue: true,
    runPipeline: false,
    manualEventName: "Amplify Informatics Conference 2027",
    manualQueueTitle: "Amplify Informatics 2027 — Atlanta (Apr 12–15) participatory anthem",
    manualQueueDescription:
      "AMIA Amplify Informatics — healthcare, technology, AI, and informatics with opening/closing plenaries. Pitch a participatory anthem for the combined clinical + research informatics gathering.",
    eventDateEstimate: "2027-04-12",
    eventDateConfidence: "confirmed",
    contacts: [
      {
        fullName: "Natalie Bisbee",
        email: "nbisbee@amia.org",
        roleTitle: "Director of Events",
        roleCategory: "events",
        emailVerificationStatus: "verified_deliverable",
        roleDescription:
          "Owns AMIA events — primary buyer for plenary / live programming moments at Amplify Informatics.",
      },
      {
        fullName: "Stephanie Brendel",
        email: "sbrendel@amia.org",
        roleTitle: "Chief Operating Officer",
        roleCategory: "executive",
        roleDescription:
          "COO — cross-department operator who can route or green-light a high-visibility conference experience.",
      },
      {
        fullName: "Raelynn Gochnauer",
        email: "rgochnauer@amia.org",
        roleTitle: "Vice President of Growth",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        roleDescription:
          "VP Growth — cares about member/attendee experience and differentiation for the new combined spring conference.",
      },
    ],
  },
  {
    name: "WorkWave AMPLIFY",
    websiteUrl: "https://www.workwave.com",
    locationCity: "New Orleans",
    locationRegion: "LA",
    locationCountry: "US",
    organizationTypeKey: "corporation",
    salesInitiative: "tech_conferences",
    opportunityTypeKey: "annual_conference",
    forceManualQueue: true,
    runPipeline: false,
    manualEventName: "WorkWave AMPLIFY 2027",
    manualQueueTitle: "WorkWave AMPLIFY 2027 — New Orleans (Jan 31–Feb 3) participatory anthem",
    manualQueueDescription:
      "WorkWave customer conference for field-service industry leadership (PestPac / RealGreen / TEAM). Pitch a shared-creation anthem for the customer community.",
    eventDateEstimate: "2027-01-31",
    eventDateConfidence: "confirmed",
    contacts: [
      {
        fullName: "Kevin Kemmerer",
        email: "kevin.kemmerer@workwave.com",
        roleTitle: "Chief Executive Officer",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        roleDescription:
          "WorkWave CEO — owns the AMPLIFY customer-conference vision; top doorway for a keynote-scale participatory moment.",
      },
      {
        fullName: "Brittany Boyle",
        email: "bboyle@workwave.com",
        roleTitle: "Director, Brand and Communications",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        roleDescription:
          "Brand and communications — natural owner for how a live anthem becomes the conference story.",
      },
      {
        fullName: "Stacy Alexander",
        email: "stacy.alexander@workwave.com",
        roleTitle: "Vice President of Growth Marketing",
        roleCategory: "marketing",
        roleDescription:
          "Growth marketing — cares about attendee acquisition and memorable moments that extend past the event.",
      },
    ],
  },
  {
    name: "Amplify Summit 2027",
    websiteUrl: "https://www.amplifyfounderverse.com",
    locationCity: "Santa Monica",
    locationRegion: "CA",
    locationCountry: "US",
    organizationTypeKey: "conference",
    salesInitiative: "tech_conferences",
    opportunityTypeKey: "annual_conference",
    forceManualQueue: true,
    runPipeline: false,
    manualEventName: "Amplify Summit 2027",
    manualQueueTitle: "Amplify Summit 2027 — Santa Monica (Apr 5–7) participatory anthem",
    manualQueueDescription:
      "Amplify Founderverse summit for founders, consumer brands, retail, and creators. Pitch a participatory anthem as a founder-community ritual.",
    eventDateEstimate: "2027-04-05",
    eventDateConfidence: "confirmed",
    contacts: [
      {
        fullName: "Hamza Naqvi",
        email: "hamza@amplifyfounderverse.com",
        roleTitle: "Co-Founder and Chief Operating Officer",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        roleDescription:
          "Co-founder / COO — owns summit operations and can green-light a signature live experience.",
      },
      {
        fullName: "Cooper Silver",
        email: "cooper@amplifyfounderverse.com",
        roleTitle: "Community Growth Manager",
        roleCategory: "marketing",
        roleDescription:
          "Community growth — cares how founders connect IRL; strong fit for a shared-creation moment.",
      },
      {
        fullName: "Hayley Tranner",
        email: "hayley@amplifyfounderverse.com",
        roleTitle: "Brand Partnerships Specialist",
        roleCategory: "marketing",
        roleDescription:
          "Brand partnerships — useful doorway for sponsored or stage-integrated participatory programming.",
      },
    ],
  },
  {
    name: "Amplify Conference",
    websiteUrl: "https://www.blinc.com",
    locationCity: "Nashville",
    locationRegion: "TN",
    locationCountry: "US",
    organizationTypeKey: "conference",
    salesInitiative: "conferences_associations",
    opportunityTypeKey: "annual_conference",
    forceManualQueue: true,
    runPipeline: false,
    manualEventName: "Amplify Conference 2027",
    manualQueueTitle: "Amplify Conference 2027 — Nashville (Jan 17–20) participatory anthem",
    manualQueueDescription:
      "Brookside Laboratories / Amplify Network — 75th annual crop and turf consulting conference. Pitch a belonging anthem for the consultant community.",
    eventDateEstimate: "2027-01-17",
    eventDateConfidence: "confirmed",
    contacts: [
      {
        fullName: "Luke Baker",
        email: "lbaker@blinc.com",
        roleTitle: "CEO",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        roleDescription:
          "Brookside CEO — owns the Amplify consultant network gathering and can green-light a flagship moment.",
      },
      {
        fullName: "Jackie Brackman",
        email: "jbrackman@blinc.com",
        roleTitle: "Chief Operating Officer",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        roleDescription:
          "COO — day-to-day operator for conference logistics and programming priorities.",
      },
      {
        fullName: "John McGuire",
        email: "jmcguire@blinc.com",
        roleTitle: "Chief Innovation Officer",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        roleDescription:
          "Chief innovation — strong fit for a forward-looking shared-creation experience tied to the innovation theme.",
      },
    ],
  },
  {
    name: "Amplify 2027 (Reynolds)",
    websiteUrl: "https://www.reyrey.com",
    locationCity: "Nashville",
    locationRegion: "TN",
    locationCountry: "US",
    organizationTypeKey: "corporation",
    salesInitiative: "tech_conferences",
    opportunityTypeKey: "annual_conference",
    forceManualQueue: true,
    runPipeline: false,
    manualEventName: "Amplify 2027",
    manualQueueTitle: "Amplify 2027 (Reynolds) — Nashville (Aug 19–20) participatory anthem",
    manualQueueDescription:
      "Reynolds and Reynolds automotive dealership leadership summit at Gaylord Opryland. Pitch a participatory anthem for dealer leaders.",
    eventDateEstimate: "2027-08-19",
    eventDateConfidence: "confirmed",
    contacts: [
      {
        fullName: "Greg Uland",
        email: "greg_uland@reyrey.com",
        roleTitle: "Vice President of Marketing",
        roleCategory: "marketing",
        roleDescription:
          "VP Marketing — owns brand and event narrative for Reynolds Amplify.",
      },
      {
        fullName: "Ashley Rench",
        email: "ashley_rench@reyrey.com",
        roleTitle: "Director of Marketing Communications",
        roleCategory: "marketing",
        roleDescription:
          "Marketing communications — strong doorway for stage moments and attendee story.",
      },
      {
        fullName: "Shawn Leibold",
        email: "shawn_leibold@reyrey.com",
        roleTitle: "Director of Industry Relations",
        roleCategory: "executive",
        emailVerificationStatus: "risky",
        roleDescription:
          "Industry relations — connected to dealer leadership; useful router for Amplify programming.",
      },
    ],
  },
  {
    name: "AMPLIFY 2027 (ICSE)",
    websiteUrl: "https://conf.researchr.org/home/icse-2027/amplify-2027",
    locationCity: "Dublin",
    locationRegion: null,
    locationCountry: "IE",
    organizationTypeKey: "conference",
    salesInitiative: "tech_conferences",
    opportunityTypeKey: "annual_conference",
    forceManualQueue: true,
    runPipeline: false,
    manualEventName: "AMPLIFY 2027 — ICSE Idea Amplification Workshop",
    manualQueueTitle: "AMPLIFY 2027 (ICSE) — Dublin (Apr 25–27) participatory anthem",
    manualQueueDescription:
      "Collaborative software-engineering research workshop co-located with ICSE 2027 in Dublin. Small facilitated room (≤40) — pitch only if a participatory close fits the Liberating Structures format; contacts are Creative Directors.",
    eventDateEstimate: "2027-04-25",
    eventDateConfidence: "estimated",
    contacts: [
      {
        fullName: "Daniel Russo",
        email: "daniel.russo@cs.aau.dk",
        roleTitle: "Creative Director (Aalborg University)",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        roleDescription:
          "Published workshop contact (daniel.russo@cs.aau.dk) — primary Creative Director for AMPLIFY at ICSE 2027.",
      },
      {
        fullName: "Margaret-Anne Storey",
        email: "mstorey@uvic.ca",
        roleTitle: "Creative Director (University of Victoria)",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        roleDescription:
          "Creative Director — co-curates seeds and workshop facilitation; senior SE research voice.",
      },
      {
        fullName: "Mauro Pezzè",
        email: "mauro.pezze@usi.ch",
        roleTitle: "Creative Director (USI Lugano)",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        roleDescription:
          "Creative Director — co-organizer; doorway for whether a participatory moment fits the workshop ethos.",
      },
    ],
  },
];
