import type { SeedOrgWithContactsInput } from "@/lib/sales/seed/seed-org-with-contacts";

/**
 * Event Leaders Exchange and its 2027 member congress in Seattle.
 * administrator@eventleaders.com is the published team inbox (FAQ, privacy policy, app listing).
 * It is not SMTP-verified.
 */
export const ELX_ANNUAL_CONGRESS_SEED: SeedOrgWithContactsInput = {
  name: "Event Leaders Exchange",
  websiteUrl: "https://www.eventleaders.com/",
  locationCity: "Seattle",
  locationRegion: "WA",
  locationCountry: "US",
  organizationTypeKey: "conference",
  salesInitiative: "conferences_associations",
  opportunityTypeKey: "annual_conference",
  forceManualQueue: true,
  runPipeline: false,
  manualEventName: "ELX Annual Congress 2027",
  manualQueueTitle: "ELX Annual Congress 2027 — Seattle (Aug 9–12) participatory anthem",
  manualQueueDescription:
    "Invitation-only congress for senior corporate event leaders, August 9–12, 2027, Hyatt Regency Seattle, with the Seattle Convention Center Summit building as a second setting. Event Leaders Exchange is delivering it with Visit Seattle. The 2026 congress in Las Vegas doubled the prior year’s attendance. CEO is Nicola Kastner (Toronto). Co-founders are Mark Brewster and David Kliman. Partnerships lead is Hannah Elston. administrator@eventleaders.com is the published membership and events inbox, not a personal mailbox and not SMTP-verified. Event page: https://www.eventleaders.com/events/elx-annual-congress-2027",
  eventDateEstimate: "2027-08-09",
  eventDateConfidence: "confirmed",
  contacts: [
    {
      fullName: "Administrator inbox",
      email: "administrator@eventleaders.com",
      roleTitle: "Published membership and events inbox",
      roleCategory: "events",
      emailVerificationStatus: "valid_format",
      roleDescription:
        "Shared inbox printed on the ELX FAQ, privacy policy, and app listing. CEO Nicola Kastner, co-founders Mark Brewster and David Kliman, and partnerships lead Hannah Elston do not have published personal addresses.",
    },
  ],
};
