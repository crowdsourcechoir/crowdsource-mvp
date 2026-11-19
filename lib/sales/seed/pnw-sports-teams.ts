import { loadPriorOutreachSuppression } from "@/lib/sales/autosend/candidates";
import { refreshAutoSendPlan, tickAutoSend } from "@/lib/sales/autosend/tick";
import {
  createContact,
  findExistingContact,
  listContactsForOrganization,
  updateContact,
} from "@/lib/sales/db/contacts";
import { findOrganizationTypeByKey } from "@/lib/sales/db/lookups";
import {
  getOpportunity,
  listOpportunitiesForOrganization,
  updateOpportunityImportMetadata,
} from "@/lib/sales/db/opportunities";
import {
  createOrganization,
  findExistingOrganization,
  getOrganization,
  updateOrganization,
} from "@/lib/sales/db/organizations";
import { listDraftsForOpportunity, updateDraftAiCopy } from "@/lib/sales/db/outreach";
import { createOrUpdateQueueItem } from "@/lib/sales/db/queue";
import { normalizeEmail } from "@/lib/sales/dedupe";
import { withSalesInitiative } from "@/lib/sales/initiatives";
import { PRICING_FRAMEWORK_VERSION } from "@/lib/sales/pricing/metadata";
import { draftCopyForContact, enqueueOrgManually } from "@/lib/sales/seed/enqueue-manual";
import type { Contact, Organization } from "@/lib/sales/types";

export const PNW_SPORTS_TEAMS_SEEDED_FLAG = "pnwSportsPartnerTeamsSeededV1";

export type PnwSportsContactSpec = {
  fullName: string;
  email: string;
  roleTitle: string;
  roleCategory: string;
  emailVerificationStatus: Contact["emailVerificationStatus"];
  hunterVerifier: string;
  hunterConfidence: number;
  primary?: boolean;
  roleDescription: string;
};

export type PnwSportsTeamSpec = {
  organizationName: string;
  alternateNames?: readonly string[];
  websiteUrl: string;
  locationCity: string;
  locationRegion: string;
  locationCountry: "US" | "CA";
  organizationTypeKey: "sports_team" | "university";
  tier: "seattle_metro" | "wa_state" | "greater_pnw";
  fanbaseLabel?: string;
  opportunityTitle: string;
  eventOrInitiativeName: string;
  description: string;
  potentialAmount: number;
  totalScoreHint: number;
  contacts: readonly PnwSportsContactSpec[];
};

export const PNW_SPORTS_PARTNER_TEAMS: readonly PnwSportsTeamSpec[] = [
  // === TIER 1: SEATTLE & PUGET SOUND PARTNER TEAMS ===
  {
    organizationName: "Seattle Sounders FC",
    alternateNames: ["Seattle Sounders", "Sounders FC"],
    websiteUrl: "https://www.soundersfc.com/",
    locationCity: "Seattle",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "seattle_metro",
    fanbaseLabel: "Sounders",
    opportunityTitle: "Fan Chant — Seattle Sounders FC (Lumen Field supporter & stadium chant pipeline)",
    eventOrInitiativeName: "Fan Chant — Sounders FC",
    description:
      "Local Seattle MLS club at Lumen Field with one of North America's strongest supporter cultures. Season-long Fan Chant & Chant Garden partnership turning Sounders supporters into co-creators of original stadium chants and matchday moments.",
    potentialAmount: 30_000,
    totalScoreHint: 92,
    contacts: [
      {
        fullName: "Jason Gingold",
        email: "jasong@soundersfc.com",
        roleTitle: "VP of Brand and Social",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 95,
        primary: true,
        roleDescription:
          "VP of Brand and Social at Seattle Sounders FC — leads supporter-facing brand story, social participation, and season-long fan identity. Verified deliverable via Hunter.",
      },
      {
        fullName: "Lauren Babcock",
        email: "laurenb@soundersfc.com",
        roleTitle: "Director of Operations",
        roleCategory: "operations",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 99,
        roleDescription:
          "Director of Operations at Seattle Sounders FC — operational doorway for matchday programming and club activations. Verified deliverable via Hunter.",
      },
      {
        fullName: "Alex Caulfield",
        email: "alexc@soundersfc.com",
        roleTitle: "Senior Vice President Communications",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 99,
        roleDescription:
          "SVP of Communications at Seattle Sounders FC — senior front-office leader across supporter narrative and external initiatives. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Seattle Reign FC",
    alternateNames: ["Reign FC", "OL Reign"],
    websiteUrl: "https://www.reignfc.com/",
    locationCity: "Seattle",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "seattle_metro",
    fanbaseLabel: "Reign",
    opportunityTitle: "Fan Chant — Seattle Reign FC (Lumen Field matchday chants & fan traditions)",
    eventOrInitiativeName: "Fan Chant — Reign FC",
    description:
      "Seattle's NWSL club at Lumen Field. Ideal local partner team for building participatory supporter chants, theme-match anthems, and sponsor-backed Chant Garden moments across the NWSL season.",
    potentialAmount: 25_000,
    totalScoreHint: 92,
    contacts: [
      {
        fullName: "Maya Exstrom",
        email: "mayam@reignfc.com",
        roleTitle: "Chief Business Officer",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 98,
        primary: true,
        roleDescription:
          "Chief Business Officer at Seattle Reign FC — oversees commercial strategy, fan experience, and partner activations at Lumen Field. Verified deliverable via Hunter.",
      },
      {
        fullName: "Lauren Carter",
        email: "laurenc@reignfc.com",
        roleTitle: "Director of Partnerships",
        roleCategory: "partnerships",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 95,
        roleDescription:
          "Director of Partnerships at Seattle Reign FC — owns brand-sponsored matchday activations and season partnership programs. Verified deliverable via Hunter.",
      },
      {
        fullName: "Kieran Lilley",
        email: "kieranl@reignfc.com",
        roleTitle: "Vice President of Operations",
        roleCategory: "operations",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 95,
        roleDescription:
          "VP of Operations at Seattle Reign FC — oversees matchday and stadium operations. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Seattle Storm",
    alternateNames: ["Storm"],
    websiteUrl: "https://storm.wnba.com/",
    locationCity: "Seattle",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "seattle_metro",
    fanbaseLabel: "Storm",
    opportunityTitle: "Fan Chant — Seattle Storm (Climate Pledge Arena game production & fan chants)",
    eventOrInitiativeName: "Fan Chant — Seattle Storm",
    description:
      "Four-time WNBA champion Seattle Storm at Climate Pledge Arena. High-energy indoor arena crowd well suited for live in-bowl participatory chants, theme-night anthems, and community-created game rituals.",
    potentialAmount: 25_000,
    totalScoreHint: 92,
    contacts: [
      {
        fullName: "Farrell Shine",
        email: "fshine@stormbasketball.com",
        roleTitle: "Director of Production",
        roleCategory: "events",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 97,
        primary: true,
        roleDescription:
          "Director of Production at Seattle Storm — directly leads Climate Pledge Arena game presentation and live in-bowl entertainment. Verified deliverable via Hunter.",
      },
      {
        fullName: "Bridget Griffith",
        email: "bgriffith@stormbasketball.com",
        roleTitle: "Vice President, Partnerships",
        roleCategory: "partnerships",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 95,
        roleDescription:
          "VP of Partnerships at Seattle Storm — leads sponsor-integrated fan activations across the WNBA season. Verified deliverable via Hunter.",
      },
      {
        fullName: "Rohre Titcomb",
        email: "rtitcomb@stormbasketball.com",
        roleTitle: "Chief Operating Officer",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 95,
        roleDescription:
          "COO at Seattle Storm — executive operator across arena experience, community, and business operations. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Seattle Kraken",
    alternateNames: ["Kraken"],
    websiteUrl: "https://www.nhl.com/kraken",
    locationCity: "Seattle",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "seattle_metro",
    fanbaseLabel: "Kraken",
    opportunityTitle: "Fan Chant — Seattle Kraken (Climate Pledge Arena game presentation & fan anthems)",
    eventOrInitiativeName: "Fan Chant — Seattle Kraken",
    description:
      "Seattle's NHL franchise at Climate Pledge Arena. Strong match for original fan-sourced arena chants, theme-night musical rituals, and corporate-partnered Chant Garden activations.",
    potentialAmount: 30_000,
    totalScoreHint: 92,
    contacts: [
      {
        fullName: "Katie Townsend",
        email: "ktownsend@seattlekrakenhockey.com",
        roleTitle: "Chief Marketing Officer",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 98,
        primary: true,
        roleDescription:
          "Chief Marketing Officer at Seattle Kraken — leads brand, fan engagement, and season-wide Kraken storytelling. Verified deliverable via Hunter.",
      },
      {
        fullName: "Lamont Buford",
        email: "lbuford@seattlekrakenhockey.com",
        roleTitle: "VP, Entertainment & Game Presentation",
        roleCategory: "events",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 99,
        roleDescription:
          "Live entertainment & game presentation leader at Seattle Kraken — shapes in-arena show and crowd participation at Climate Pledge Arena. Verified deliverable via Hunter.",
      },
      {
        fullName: "Jeff Webster",
        email: "jwebster@seattlekrakenhockey.com",
        roleTitle: "Chief Commercial Officer",
        roleCategory: "partnerships",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 99,
        roleDescription:
          "Commercial & partnerships executive at Seattle Kraken. Verified deliverable via Hunter.",
      },
      {
        fullName: "Tod Leiweke",
        email: "tleiweke@seattlekrakenhockey.com",
        roleTitle: "Chief Executive Officer",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 99,
        roleDescription:
          "CEO of Seattle Kraken — top club executive. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Seattle Torrent",
    alternateNames: ["PWHL Seattle", "Torrent"],
    websiteUrl: "https://www.thepwhl.com/en/teams/seattle-torrent",
    locationCity: "Seattle",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "seattle_metro",
    fanbaseLabel: "Torrent",
    opportunityTitle: "Fan Chant — Seattle Torrent (PWHL inaugural traditions & Climate Pledge Arena Unity Games)",
    eventOrInitiativeName: "Fan Chant — Seattle Torrent",
    description:
      "Seattle's PWHL women's pro hockey club at Climate Pledge Arena, actively building brand-new home-ice traditions, Unity Games, and theme-night programming. Madi McNamara (Director of Business Operations) is publicly leading Seattle Torrent game presentations.",
    potentialAmount: 20_000,
    totalScoreHint: 91,
    contacts: [
      {
        fullName: "Madi McNamara",
        email: "madi.mcnamara@thepwhl.com",
        roleTitle: "Director of Business Operations, Seattle Torrent",
        roleCategory: "events",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 97,
        primary: true,
        roleDescription:
          "Director of Business Operations on the ground in Seattle for the Torrent — publicly quoted leading Seattle Torrent game presentations and in-arena fan experience at Climate Pledge Arena. Verified deliverable via Hunter.",
      },
      {
        fullName: "Ali Bologna",
        email: "ali.bologna@thepwhl.com",
        roleTitle: "Senior Director, Brand & Marketing",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 99,
        roleDescription:
          "Senior Director of Brand & Marketing at PWHL — led the Seattle Torrent brand identity and fan-facing launch. Verified deliverable via Hunter.",
      },
      {
        fullName: "Meghan Turner",
        email: "meghan.turner@thepwhl.com",
        roleTitle: "General Manager, Seattle Torrent",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 99,
        roleDescription:
          "General Manager of the Seattle Torrent. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Seattle Mariners",
    alternateNames: ["Mariners"],
    websiteUrl: "https://www.mlb.com/mariners",
    locationCity: "Seattle",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "seattle_metro",
    fanbaseLabel: "Mariners",
    opportunityTitle: "Fan Chant — Seattle Mariners (T-Mobile Park game entertainment, FanFest & season chants)",
    eventOrInitiativeName: "Fan Chant — Seattle Mariners",
    description:
      "Seattle's MLB club at T-Mobile Park. Participatory ballpark chants, FanFest crowd anthem, and 81-home-game season participation pipeline.",
    potentialAmount: 30_000,
    totalScoreHint: 91,
    contacts: [
      {
        fullName: "Tyler Thompson",
        email: "tthompson@mariners.com",
        roleTitle: "Director of Marketing",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 95,
        primary: true,
        roleDescription:
          "Director of Marketing at Seattle Mariners — leads ballpark marketing and fan-facing campaigns. Verified deliverable via Hunter.",
      },
      {
        fullName: "Malcolm Rogel",
        email: "mrogel@mariners.com",
        roleTitle: "Vice President, Customer Experience",
        roleCategory: "events",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 98,
        roleDescription:
          "VP of Customer Experience at Seattle Mariners — oversees T-Mobile Park guest & fan experience. Verified deliverable via Hunter.",
      },
      {
        fullName: "April Huff-Martin",
        email: "april.huff@mariners.com",
        roleTitle: "Director of Ballpark Operations",
        roleCategory: "operations",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 95,
        roleDescription:
          "Director of Ballpark Operations at T-Mobile Park. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Seattle Seahawks",
    alternateNames: ["Seahawks"],
    websiteUrl: "https://www.seahawks.com/",
    locationCity: "Seattle",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "seattle_metro",
    fanbaseLabel: "Seahawks",
    opportunityTitle: "Fan Chant — Seattle Seahawks (Training camp & 12s stadium anthem)",
    eventOrInitiativeName: "Fan Chant — Seattle Seahawks",
    description:
      "Seattle's NFL franchise at Lumen Field. Participatory training-camp team experience, original 12s stadium anthem, and season-long crowdsourced chant pipeline.",
    potentialAmount: 35_000,
    totalScoreHint: 91,
    contacts: [
      {
        fullName: "Tyler Cofer",
        email: "tylerc@seahawks.com",
        roleTitle: "Director of Game Entertainment & Special Events",
        roleCategory: "events",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 98,
        primary: true,
        roleDescription:
          "Director of Game Entertainment & Special Events at Seattle Seahawks — primary buyer for in-stadium entertainment, training-camp rituals, and 12s live moments.",
      },
      {
        fullName: "Lee Herteg",
        email: "leeh@seahawks.com",
        roleTitle: "Manager, Entertainment Experience & Programming",
        roleCategory: "events",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 98,
        roleDescription:
          "Manager of Entertainment Experience & Programming at Seattle Seahawks.",
      },
      {
        fullName: "Allison Hoover",
        email: "allisonh@seahawks.com",
        roleTitle: "Managing Director of Marketing",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 98,
        roleDescription:
          "Managing Director of Marketing at Seattle Seahawks.",
      },
    ],
  },
  {
    organizationName: "University of Washington Athletics",
    alternateNames: ["UW Huskies", "Washington Huskies Athletics", "UW Athletics"],
    websiteUrl: "https://gohuskies.com/",
    locationCity: "Seattle",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "university",
    tier: "seattle_metro",
    fanbaseLabel: "Washington Husky",
    opportunityTitle: "Fan Chant — University of Washington Athletics (Husky basketball & stadium chants)",
    eventOrInitiativeName: "Fan Chant — UW Huskies",
    description:
      "Big Ten athletics right in Seattle (Alaska Airlines Arena & Husky Stadium). Published UW Athletics Marketing & Fan Engagement leaders verified via Hunter.",
    potentialAmount: 25_000,
    totalScoreHint: 90,
    contacts: [
      {
        fullName: "Mason Gunnell",
        email: "mgunnell@uw.edu",
        roleTitle: "Director of Marketing & Fan Engagement (Men's Basketball & Baseball)",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 95,
        primary: true,
        roleDescription:
          "Director of Marketing & Fan Engagement for Men's Basketball and Baseball at UW Huskies Athletics (gohuskies.com staff directory). Verified deliverable via Hunter SMTP check.",
      },
      {
        fullName: "Sarah Frasier",
        email: "frasier1@uw.edu",
        roleTitle: "Associate Director of Marketing & Fan Engagement (Women's Basketball & Volleyball)",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 95,
        roleDescription:
          "Associate Director of Marketing & Fan Engagement for Women's Basketball & Volleyball at UW Athletics (gohuskies.com staff directory). Verified deliverable via Hunter SMTP check.",
      },
    ],
  },
  {
    organizationName: "Seattle University Athletics",
    alternateNames: ["Seattle University", "Seattle U Redhawks Athletics"],
    websiteUrl: "https://goseattleu.com/",
    locationCity: "Seattle",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "university",
    tier: "seattle_metro",
    fanbaseLabel: "Seattle U Redhawks",
    opportunityTitle: "Fan Chant — Seattle University Athletics (Redhawks student & fan chant culture)",
    eventOrInitiativeName: "Fan Chant — Seattle U Redhawks",
    description:
      "Division I athletics on Capitol Hill / First Hill in Seattle entering WCC play, with games at Redhawk Center and Climate Pledge Arena — ideal agile local partner team for piloting Chant Garden and live student-led game chants.",
    potentialAmount: 18_000,
    totalScoreHint: 89,
    contacts: [
      {
        fullName: "Andres Gonzalez",
        email: "agonzalez5@seattleu.edu",
        roleTitle: "Assistant Athletic Director for Marketing and Fan Experience",
        roleCategory: "marketing",
        emailVerificationStatus: "valid_format",
        hunterVerifier: "accept_all",
        hunterConfidence: 85,
        primary: true,
        roleDescription:
          "Assistant Athletic Director for Marketing and Fan Experience at Seattle University Athletics (published on goseattleu.com/staff-directory).",
      },
      {
        fullName: "Shaney Fink",
        email: "finks@seattleu.edu",
        roleTitle: "Vice President of Athletics",
        roleCategory: "executive",
        emailVerificationStatus: "valid_format",
        hunterVerifier: "accept_all",
        hunterConfidence: 85,
        roleDescription:
          "Vice President of Athletics at Seattle University (published on goseattleu.com/staff-directory).",
      },
    ],
  },
  {
    organizationName: "Tacoma Rainiers",
    alternateNames: ["We R Tacoma"],
    websiteUrl: "https://www.milb.com/tacoma",
    locationCity: "Tacoma",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "seattle_metro",
    fanbaseLabel: "Tacoma Rainiers",
    opportunityTitle: "Fan Chant — Tacoma Rainiers (Cheney Stadium fan-sourced chants & theme nights)",
    eventOrInitiativeName: "Fan Chant — Tacoma Rainiers",
    description:
      "Mariners Triple-A affiliate at Cheney Stadium in Tacoma — creative minor-league front office built for interactive fan entertainment, sponsor-backed chants, and recurring summer ballpark traditions.",
    potentialAmount: 18_000,
    totalScoreHint: 89,
    contacts: [
      {
        fullName: "Megan Mead",
        email: "mmead@tacomarainiers.com",
        roleTitle: "Vice President of Marketing",
        roleCategory: "marketing",
        emailVerificationStatus: "valid_format",
        hunterVerifier: "accept_all",
        hunterConfidence: 83,
        primary: true,
        roleDescription:
          "Vice President of Marketing at Tacoma Rainiers — leads brand, promotions, and Cheney Stadium fan campaigns.",
      },
      {
        fullName: "Aaron Artman",
        email: "aartman@tacomarainiers.com",
        roleTitle: "President",
        roleCategory: "executive",
        emailVerificationStatus: "valid_format",
        hunterVerifier: "accept_all",
        hunterConfidence: 83,
        roleDescription:
          "President of the Tacoma Rainiers — top decision-maker for ballpark entertainment and strategic partnerships.",
      },
      {
        fullName: "Ashley Schutt",
        email: "aschutt@tacomarainiers.com",
        roleTitle: "Director of Operations",
        roleCategory: "operations",
        emailVerificationStatus: "valid_format",
        hunterVerifier: "accept_all",
        hunterConfidence: 85,
        roleDescription:
          "Director of Operations at Tacoma Rainiers.",
      },
    ],
  },
  {
    organizationName: "Everett Silvertips",
    websiteUrl: "https://chl.ca/whl-silvertips/",
    locationCity: "Everett",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "seattle_metro",
    fanbaseLabel: "Everett Silvertips",
    opportunityTitle: "Fan Chant — Everett Silvertips (Angel of the Winds Arena WHL fan chants)",
    eventOrInitiativeName: "Fan Chant — Everett Silvertips",
    description:
      "WHL hockey club 30 minutes north of Seattle at Angel of the Winds Arena, renowned for loud cowbell-and-chant arena energy and community-driven game presentation.",
    potentialAmount: 18_000,
    totalScoreHint: 89,
    contacts: [
      {
        fullName: "Anna Stensland",
        email: "annas@everettsilvertips.com",
        roleTitle: "Director of Events",
        roleCategory: "events",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 98,
        primary: true,
        roleDescription:
          "Director of Events at Everett Silvertips — owns live game-night events and arena fan programming. Verified deliverable via Hunter.",
      },
      {
        fullName: "Joel Anderson",
        email: "joela@everettsilvertips.com",
        roleTitle: "Director of Partnerships",
        roleCategory: "partnerships",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 94,
        roleDescription:
          "Director of Partnerships at Everett Silvertips — leads sponsor-backed game-night activations. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Seattle Thunderbirds",
    websiteUrl: "https://chl.ca/whl-thunderbirds/",
    locationCity: "Kent",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "seattle_metro",
    fanbaseLabel: "Seattle Thunderbirds",
    opportunityTitle: "Fan Chant — Seattle Thunderbirds (accesso ShoWare Center WHL fan traditions)",
    eventOrInitiativeName: "Fan Chant — Seattle Thunderbirds",
    description:
      "South Puget Sound WHL hockey club at accesso ShoWare Center in Kent with passionate local hockey traditions and corporate partner nights.",
    potentialAmount: 18_000,
    totalScoreHint: 88,
    contacts: [
      {
        fullName: "Colin Campbell",
        email: "colinc@seattlethunderbirds.com",
        roleTitle: "President",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 78,
        primary: true,
        roleDescription:
          "President of Seattle Thunderbirds — leads club business, arena atmosphere, and strategic partnerships. Verified deliverable via Hunter.",
      },
      {
        fullName: "Jason Thomsen",
        email: "jasont@seattlethunderbirds.com",
        roleTitle: "Vice President of Corporate Partnerships",
        roleCategory: "partnerships",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 67,
        roleDescription:
          "VP of Corporate Partnerships at Seattle Thunderbirds — pairs local sponsors with in-arena fan moments. Verified deliverable via Hunter.",
      },
      {
        fullName: "Malea Baumgartner",
        email: "mbaumgartner@seattlethunderbirds.com",
        roleTitle: "Social Media Director",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 69,
        roleDescription:
          "Social Media Director at Seattle Thunderbirds. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Everett AquaSox",
    websiteUrl: "https://www.milb.com/everett",
    locationCity: "Everett",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "seattle_metro",
    fanbaseLabel: "Everett AquaSox",
    opportunityTitle: "Fan Chant — Everett AquaSox (Mariners High-A ballpark chants & sponsor nights)",
    eventOrInitiativeName: "Fan Chant — Everett AquaSox",
    description:
      "Seattle Mariners High-A affiliate in Everett — approachable local Puget Sound partner club with strong community/sponsor tie-ins and summer ballpark crowds.",
    potentialAmount: 16_000,
    totalScoreHint: 87,
    contacts: [
      {
        fullName: "Danny Tetzlaff",
        email: "dannyt@aquasox.com",
        roleTitle: "General Manager",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 93,
        primary: true,
        roleDescription:
          "General Manager of the Everett AquaSox — oversees ballpark experience, promotions, and community partnerships. Verified deliverable via Hunter.",
      },
      {
        fullName: "Mike MacCulloch",
        email: "mikem@aquasox.com",
        roleTitle: "Director of Partnerships",
        roleCategory: "partnerships",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 99,
        roleDescription:
          "Director of Partnerships at Everett AquaSox. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Seattle Seawolves",
    alternateNames: ["Seawolves"],
    websiteUrl: "https://www.seattleseawolves.com/",
    locationCity: "Tukwila",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "seattle_metro",
    fanbaseLabel: "Seattle Seawolves",
    opportunityTitle: "Fan Chant — Seattle Seawolves (Starfire Stadium rugby chants & Together We Hunt culture)",
    eventOrInitiativeName: "Fan Chant — Seattle Seawolves",
    description:
      "Two-time Major League Rugby champion Seattle Seawolves at Starfire Stadium in Tukwila — intimate, vocal rugby crowd built for call-and-response chants and local Seattle partner piloting.",
    potentialAmount: 16_000,
    totalScoreHint: 87,
    contacts: [
      {
        fullName: "Adrian Balfour",
        email: "adrian@seattleseawolves.com",
        roleTitle: "Founder & Chairman",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 85,
        primary: true,
        roleDescription:
          "Founder & Chairman of Seattle Seawolves Rugby — passionate steward of the Starfire matchday atmosphere and Seawolves supporter culture. Verified deliverable via Hunter.",
      },
      {
        fullName: "Mat Turner",
        email: "mat@seattleseawolves.com",
        roleTitle: "Club Leadership",
        roleCategory: "operations",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 85,
        roleDescription:
          "Former Seawolves captain & front-office club leader. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Seattle Orcas",
    alternateNames: ["Orcas"],
    websiteUrl: "https://www.seattleorcas.com/",
    locationCity: "Seattle",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "seattle_metro",
    fanbaseLabel: "Seattle Orcas",
    opportunityTitle: "Fan Chant — Seattle Orcas (Major League Cricket fan chants & Seattle matchday festival)",
    eventOrInitiativeName: "Fan Chant — Seattle Orcas",
    description:
      "Seattle's Major League Cricket franchise — cricket matchdays thrive on musical chants, rhythms, and crowd-wide participation.",
    potentialAmount: 18_000,
    totalScoreHint: 86,
    contacts: [
      {
        fullName: "Jagan Nemani",
        email: "jagan@seattleorcas.com",
        roleTitle: "Executive Leadership / Chief Product Officer",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 79,
        primary: true,
        roleDescription:
          "Executive leadership at Seattle Orcas — builds digital & matchday fan engagement for Seattle's Major League Cricket club. Verified deliverable via Hunter.",
      },
      {
        fullName: "Jessica Ivey",
        email: "jessica@seattleorcas.com",
        roleTitle: "Communications & Media Lead",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 85,
        roleDescription:
          "Communications & media lead at Seattle Orcas. Verified deliverable via Hunter SMTP check.",
      },
    ],
  },

  // === TIER 2: WASHINGTON STATE PARTNER TEAMS ===
  {
    organizationName: "USL Spokane (Spokane Velocity FC & Spokane Zephyr FC)",
    alternateNames: ["USL Spokane", "Spokane Velocity FC", "Spokane Zephyr FC"],
    websiteUrl: "https://www.uslspokane.com/",
    locationCity: "Spokane",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "wa_state",
    fanbaseLabel: "Spokane Velocity & Zephyr",
    opportunityTitle: "Fan Chant — USL Spokane (Velocity FC & Zephyr FC supporter chants at ONE Spokane Stadium)",
    eventOrInitiativeName: "Fan Chant — USL Spokane",
    description:
      "Dual pro soccer clubs (USL League One men's Spokane Velocity FC & USL Super League women's Spokane Zephyr FC) at downtown ONE Spokane Stadium — young clubs actively forging supporter songs, chants, and sponsor traditions across two seasons per year.",
    potentialAmount: 20_000,
    totalScoreHint: 89,
    contacts: [
      {
        fullName: "Dave Sonntag",
        email: "dave@uslspokane.com",
        roleTitle: "Vice President of Marketing and Communications",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 99,
        primary: true,
        roleDescription:
          "VP of Marketing & Communications for USL Spokane (Velocity FC & Zephyr FC) — leads fan culture, brand, and matchday marketing across both clubs. Verified deliverable via Hunter.",
      },
      {
        fullName: "Katie Harnetiaux",
        email: "katie@uslspokane.com",
        roleTitle: "President, USL Spokane & Co-Owner",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 94,
        roleDescription:
          "President of USL Spokane — leads Spokane Zephyr FC and Velocity FC vision and community impact. Verified deliverable via Hunter.",
      },
      {
        fullName: "Sandra Vance",
        email: "sandra@uslspokane.com",
        roleTitle: "Director of Community",
        roleCategory: "events",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 98,
        roleDescription:
          "Director of Community at USL Spokane. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Spokane Chiefs",
    websiteUrl: "https://chl.ca/whl-chiefs/",
    locationCity: "Spokane",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "wa_state",
    fanbaseLabel: "Spokane Chiefs",
    opportunityTitle: "Fan Chant — Spokane Chiefs (Spokane Arena WHL game-night chants & sponsor activations)",
    eventOrInitiativeName: "Fan Chant — Spokane Chiefs",
    description:
      "Flagship Eastern Washington WHL club at Spokane Arena with dedicated CMO, marketing, and sponsorship leads ready for fan-created arena chants.",
    potentialAmount: 18_000,
    totalScoreHint: 88,
    contacts: [
      {
        fullName: "Dave Pier",
        email: "dpier@spokanechiefs.com",
        roleTitle: "Chief Marketing Officer",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 92,
        primary: true,
        roleDescription:
          "CMO at Spokane Chiefs — oversees marketing, game-night entertainment, and fan engagement at Spokane Arena. Verified deliverable via Hunter.",
      },
      {
        fullName: "Josh Grubich",
        email: "jgrubich@spokanechiefs.com",
        roleTitle: "Director of Marketing",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 91,
        roleDescription:
          "Director of Marketing at Spokane Chiefs. Verified deliverable via Hunter.",
      },
      {
        fullName: "Brian Cobb",
        email: "bcobb@spokanechiefs.com",
        roleTitle: "Director of Sponsorships",
        roleCategory: "partnerships",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 67,
        roleDescription:
          "Director of Sponsorships at Spokane Chiefs. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Washington State University Athletics",
    alternateNames: ["WSU Cougars", "WSU Athletics", "Washington State Athletics"],
    websiteUrl: "https://wsucougars.com/",
    locationCity: "Pullman",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "university",
    tier: "wa_state",
    fanbaseLabel: "WSU Cougar",
    opportunityTitle: "Fan Chant — Washington State University Athletics (Cougar student & fan chant pipeline)",
    eventOrInitiativeName: "Fan Chant — WSU Cougars",
    description:
      "Pac-12 rebuild era in Pullman with fiercely loyal Cougar fans statewide (including Seattle alumni nights) — published WSU Brand, Promotions & Fan Experience directors.",
    potentialAmount: 22_000,
    totalScoreHint: 88,
    contacts: [
      {
        fullName: "Paul Dennis",
        email: "paul.dennis@wsu.edu",
        roleTitle: "Director of Marketing and Fan Experience",
        roleCategory: "marketing",
        emailVerificationStatus: "valid_format",
        hunterVerifier: "accept_all",
        hunterConfidence: 85,
        primary: true,
        roleDescription:
          "Director of Marketing and Fan Experience at Washington State University Athletics (published on wsucougars.com/staff-directory).",
      },
      {
        fullName: "Miranda Holt",
        email: "miranda.holt@wsu.edu",
        roleTitle: "Associate Director of Athletics for Brand, Promotions and Marketing",
        roleCategory: "marketing",
        emailVerificationStatus: "valid_format",
        hunterVerifier: "accept_all",
        hunterConfidence: 85,
        roleDescription:
          "Associate AD for Brand, Promotions and Marketing at WSU Athletics (published on wsucougars.com/staff-directory).",
      },
    ],
  },
  {
    organizationName: "Eastern Washington University Athletics",
    alternateNames: ["EWU Athletics", "Eastern Washington Eagles Athletics"],
    websiteUrl: "https://goeags.com/",
    locationCity: "Cheney",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "university",
    tier: "wa_state",
    fanbaseLabel: "Eastern Washington Eagles",
    opportunityTitle: "Fan Chant — Eastern Washington University Athletics (Roos Field & Reese Court fan chants)",
    eventOrInitiativeName: "Fan Chant — EWU Eagles",
    description:
      "Division I Big Sky athletics in Cheney/Spokane, WA — nimble Washington university partner for student-section Chant Garden and basketball/football traditions.",
    potentialAmount: 16_000,
    totalScoreHint: 85,
    contacts: [
      {
        fullName: "Brent Reser",
        email: "breser@ewu.edu",
        roleTitle: "Marketing Director",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 98,
        primary: true,
        roleDescription:
          "Marketing Director at Eastern Washington University. Verified deliverable via Hunter.",
      },
      {
        fullName: "Bridgette Underwood",
        email: "bunderwood1@ewu.edu",
        roleTitle: "Director of Athletic Communications",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 97,
        roleDescription:
          "Director of Athletic Communications at EWU Athletics. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Wenatchee Wild",
    websiteUrl: "https://chl.ca/whl-wild/",
    locationCity: "Wenatchee",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "wa_state",
    fanbaseLabel: "Wenatchee Wild",
    opportunityTitle: "Fan Chant — Wenatchee Wild (Town Toyota Center WHL fan chants)",
    eventOrInitiativeName: "Fan Chant — Wenatchee Wild",
    description:
      "Central Washington's WHL hockey club at Town Toyota Center — tight-knit community fanbase and sponsor ecosystem.",
    potentialAmount: 15_000,
    totalScoreHint: 85,
    contacts: [
      {
        fullName: "Gretchen Littler",
        email: "glittler@wenatcheewildhockey.com",
        roleTitle: "Director of Sales and Marketing",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 92,
        primary: true,
        roleDescription:
          "Director of Sales and Marketing at Wenatchee Wild — leads marketing, sponsor nights, and fan experience. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Bellingham Bells",
    websiteUrl: "https://bellinghambells.com/",
    locationCity: "Bellingham",
    locationRegion: "WA",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "wa_state",
    fanbaseLabel: "Bellingham Bells",
    opportunityTitle: "Fan Chant — Bellingham Bells (Joe Martin Field summer baseball fan chants)",
    eventOrInitiativeName: "Fan Chant — Bellingham Bells",
    description:
      "High-attendance West Coast League baseball club in Bellingham, WA (90 minutes north of Seattle) — creative, community-first local partner team for piloting live fan-sourced ballpark chants.",
    potentialAmount: 15_000,
    totalScoreHint: 85,
    contacts: [
      {
        fullName: "Stephanie Morrell",
        email: "stephanie@bellinghambells.com",
        roleTitle: "President",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 85,
        primary: true,
        roleDescription:
          "President of the Bellingham Bells — oversees club strategy, community partnerships, and Joe Martin Field gameday atmosphere. Verified deliverable via Hunter.",
      },
      {
        fullName: "Hayley McGee",
        email: "hayley@bellinghambells.com",
        roleTitle: "Marketing Manager",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 85,
        roleDescription:
          "Marketing Manager at Bellingham Bells. Verified deliverable via Hunter.",
      },
    ],
  },

  // === TIER 3: GREATER PACIFIC NORTHWEST (OREGON, IDAHO, BRITISH COLUMBIA) ===
  {
    organizationName: "Portland Thorns FC",
    alternateNames: ["Thorns FC", "Portland Thorns"],
    websiteUrl: "https://www.thorns.com/",
    locationCity: "Portland",
    locationRegion: "OR",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "greater_pnw",
    fanbaseLabel: "Portland Thorns",
    opportunityTitle: "Fan Chant — Portland Thorns FC (Providence Park game presentation & Riveters chant culture)",
    eventOrInitiativeName: "Fan Chant — Portland Thorns FC",
    description:
      "Premier NWSL attendance & supporter culture at Providence Park in Portland — direct Director of Game Presentation and Partnership leads verified deliverable.",
    potentialAmount: 25_000,
    totalScoreHint: 90,
    contacts: [
      {
        fullName: "Rachel Scoggins",
        email: "rscoggins@thorns.com",
        roleTitle: "Director of Game Presentation",
        roleCategory: "events",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 95,
        primary: true,
        roleDescription:
          "Director of Game Presentation at Portland Thorns FC — directly owns live stadium show and participatory fan moments at Providence Park. Verified deliverable via Hunter.",
      },
      {
        fullName: "Matt Stern",
        email: "mstern@thorns.com",
        roleTitle: "Director of Partnerships",
        roleCategory: "partnerships",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 97,
        roleDescription:
          "Director of Partnerships at Portland Thorns FC — leads sponsor-backed fan activations. Verified deliverable via Hunter SMTP check.",
      },
      {
        fullName: "Zoe Raiter",
        email: "zraiter@thorns.com",
        roleTitle: "Director of Community Engagement",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 98,
        roleDescription:
          "Director of Community Engagement at Portland Thorns FC. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Portland Timbers",
    alternateNames: ["Timbers"],
    websiteUrl: "https://www.timbers.com/",
    locationCity: "Portland",
    locationRegion: "OR",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "greater_pnw",
    fanbaseLabel: "Portland Timbers",
    opportunityTitle: "Fan Chant — Portland Timbers (Providence Park supporter chants & season activations)",
    eventOrInitiativeName: "Fan Chant — Portland Timbers",
    description:
      "Iconic Pacific Northwest MLS club at Providence Park in Portland — deep chant heritage and sponsor-integrated fan culture.",
    potentialAmount: 25_000,
    totalScoreHint: 89,
    contacts: [
      {
        fullName: "Marc Kostic",
        email: "mkostic@timbers.com",
        roleTitle: "Marketing Director",
        roleCategory: "marketing",
        emailVerificationStatus: "valid_format",
        hunterVerifier: "accept_all",
        hunterConfidence: 81,
        primary: true,
        roleDescription:
          "Marketing Director at Portland Timbers — leads supporter-facing marketing and season storytelling.",
      },
      {
        fullName: "Todd Spear",
        email: "tspear@timbers.com",
        roleTitle: "Vice President, Partnerships",
        roleCategory: "partnerships",
        emailVerificationStatus: "valid_format",
        hunterVerifier: "accept_all",
        hunterConfidence: 84,
        roleDescription:
          "VP of Partnerships at Portland Timbers.",
      },
      {
        fullName: "Ashley Highsmith",
        email: "ahighsmith@timbers.com",
        roleTitle: "Chief Operating Officer",
        roleCategory: "executive",
        emailVerificationStatus: "valid_format",
        hunterVerifier: "accept_all",
        hunterConfidence: 81,
        roleDescription:
          "Chief Operating Officer at Portland Timbers.",
      },
    ],
  },
  {
    organizationName: "Portland Trail Blazers",
    alternateNames: ["Trail Blazers"],
    websiteUrl: "https://www.nba.com/blazers",
    locationCity: "Portland",
    locationRegion: "OR",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "greater_pnw",
    fanbaseLabel: "Rip City / Trail Blazers",
    opportunityTitle: "Fan Chant — Portland Trail Blazers (Moda Center Rip City live arena chants)",
    eventOrInitiativeName: "Fan Chant — Trail Blazers",
    description:
      "Pacific Northwest NBA franchise at Moda Center in Portland — 41 home games of indoor arena energy for Rip City fan-created chants and anthems.",
    potentialAmount: 30_000,
    totalScoreHint: 89,
    contacts: [
      {
        fullName: "Michael Betts",
        email: "michael.betts@trailblazers.com",
        roleTitle: "Director of Events",
        roleCategory: "events",
        emailVerificationStatus: "valid_format",
        hunterVerifier: "accept_all",
        hunterConfidence: 84,
        primary: true,
        roleDescription:
          "Director of Events at Portland Trail Blazers — leads live events and Moda Center programming.",
      },
      {
        fullName: "Chris Oxley",
        email: "chris.oxley@trailblazers.com",
        roleTitle: "General Manager, Rose Quarter Operations",
        roleCategory: "operations",
        emailVerificationStatus: "valid_format",
        hunterVerifier: "accept_all",
        hunterConfidence: 83,
        roleDescription:
          "General Manager at Trail Blazers / Rose Quarter.",
      },
    ],
  },
  {
    organizationName: "Portland Winterhawks",
    websiteUrl: "https://chl.ca/whl-winterhawks/",
    locationCity: "Portland",
    locationRegion: "OR",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "greater_pnw",
    fanbaseLabel: "Portland Winterhawks",
    opportunityTitle: "Fan Chant — Portland Winterhawks (Veterans Memorial Coliseum game entertainment)",
    eventOrInitiativeName: "Fan Chant — Portland Winterhawks",
    description:
      "Historic PNW WHL franchise in Portland with dedicated Entertainment Operations Manager and verified front-office leads.",
    potentialAmount: 18_000,
    totalScoreHint: 88,
    contacts: [
      {
        fullName: "Katie Zandi",
        email: "katiez@winterhawks.com",
        roleTitle: "Entertainment Operations Manager",
        roleCategory: "events",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 95,
        primary: true,
        roleDescription:
          "Entertainment Operations Manager at Portland Winterhawks — directly runs in-arena game entertainment and crowd engagement. Verified deliverable via Hunter SMTP check.",
      },
      {
        fullName: "Lisa Hollenbeck",
        email: "lisah@winterhawks.com",
        roleTitle: "Vice President of Operations",
        roleCategory: "operations",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 97,
        roleDescription:
          "VP of Operations at Portland Winterhawks. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Portland Pickles",
    websiteUrl: "https://www.portlandpicklesbaseball.com/",
    locationCity: "Portland",
    locationRegion: "OR",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "greater_pnw",
    fanbaseLabel: "Portland Pickles",
    opportunityTitle: "Fan Chant — Portland Pickles (Walker Stadium viral fan culture & crowdsourced ballpark anthems)",
    eventOrInitiativeName: "Fan Chant — Portland Pickles",
    description:
      "Pacific Northwest's most experimental, viral independent baseball club (Savannah Bananas ethos of the NW) — natural creative partner for fan-created chants and live participatory shows.",
    potentialAmount: 16_000,
    totalScoreHint: 88,
    contacts: [
      {
        fullName: "Scott Barchus",
        email: "scott@portlandpicklesbaseball.com",
        roleTitle: "Owner",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 75,
        primary: true,
        roleDescription:
          "Owner of the Portland Pickles — champions unconventional, high-participation ballpark entertainment at Walker Stadium. Verified deliverable via Hunter.",
      },
      {
        fullName: "Erik Hughes",
        email: "erik@portlandpicklesbaseball.com",
        roleTitle: "Director",
        roleCategory: "events",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 75,
        roleDescription:
          "Director at Portland Pickles. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Hillsboro Hops",
    websiteUrl: "https://www.milb.com/hillsboro",
    locationCity: "Hillsboro",
    locationRegion: "OR",
    locationCountry: "US",
    organizationTypeKey: "sports_team",
    tier: "greater_pnw",
    fanbaseLabel: "Hillsboro Hops",
    opportunityTitle: "Fan Chant — Hillsboro Hops (New Hillsboro Ballpark era fan chants & sponsor activations)",
    eventOrInitiativeName: "Fan Chant — Hillsboro Hops",
    description:
      "Portland-metro High-A baseball club launching new ballpark traditions — verified Senior Marketing and VP Partnerships leads.",
    potentialAmount: 16_000,
    totalScoreHint: 86,
    contacts: [
      {
        fullName: "Blake Morris",
        email: "blakem@hillsborohops.com",
        roleTitle: "Senior Director of Marketing",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 91,
        primary: true,
        roleDescription:
          "Senior Director of Marketing at Hillsboro Hops — leads brand, fan engagement, and gameday experience. Verified deliverable via Hunter.",
      },
      {
        fullName: "Matt Kolasinski",
        email: "mattk@hillsborohops.com",
        roleTitle: "Vice President of Partnerships",
        roleCategory: "partnerships",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 93,
        roleDescription:
          "VP of Partnerships at Hillsboro Hops. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "University of Oregon Athletics",
    alternateNames: ["Oregon Ducks Athletics", "Oregon Athletics"],
    websiteUrl: "https://goducks.com/",
    locationCity: "Eugene",
    locationRegion: "OR",
    locationCountry: "US",
    organizationTypeKey: "university",
    tier: "greater_pnw",
    fanbaseLabel: "Oregon Ducks",
    opportunityTitle: "Fan Chant — University of Oregon Athletics (Matthew Knight Arena & Autzen Stadium fan chants)",
    eventOrInitiativeName: "Fan Chant — Oregon Ducks",
    description:
      "Flagship Big Ten Pacific Northwest athletics program in Eugene — published Assistant AD & Director of Marketing and Fan Experience.",
    potentialAmount: 25_000,
    totalScoreHint: 89,
    contacts: [
      {
        fullName: "Brooke Robinson",
        email: "brob@uoregon.edu",
        roleTitle: "Assistant Athletic Director, Marketing & Fan Experience",
        roleCategory: "marketing",
        emailVerificationStatus: "valid_format",
        hunterVerifier: "accept_all",
        hunterConfidence: 85,
        primary: true,
        roleDescription:
          "Assistant Athletic Director for Marketing & Fan Experience at Oregon Ducks Athletics (published on goducks.com/staff-directory).",
      },
      {
        fullName: "Darren Mason",
        email: "dmas@uoregon.edu",
        roleTitle: "Director of Marketing and Fan Experience",
        roleCategory: "marketing",
        emailVerificationStatus: "valid_format",
        hunterVerifier: "accept_all",
        hunterConfidence: 85,
        roleDescription:
          "Director of Marketing and Fan Experience at Oregon Ducks Athletics (published on goducks.com/staff-directory).",
      },
    ],
  },
  {
    organizationName: "Boise State University Athletics",
    alternateNames: ["Boise State Broncos Athletics", "Boise State Athletics"],
    websiteUrl: "https://broncosports.com/",
    locationCity: "Boise",
    locationRegion: "ID",
    locationCountry: "US",
    organizationTypeKey: "university",
    tier: "greater_pnw",
    fanbaseLabel: "Boise State Broncos",
    opportunityTitle: "Fan Chant — Boise State University Athletics (Albertsons Stadium & ExtraMile Arena fan chants)",
    eventOrInitiativeName: "Fan Chant — Boise State Broncos",
    description:
      "Pac-12 bound Boise State Athletics with dedicated Boise State Sports & Entertainment Group and verified Marketing & Fan Experience leadership.",
    potentialAmount: 22_000,
    totalScoreHint: 88,
    contacts: [
      {
        fullName: "Michael Murtagh",
        email: "michaelmurtagh@boisestate.edu",
        roleTitle: "Assistant Athletic Director, Marketing and Fan Experience",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 99,
        primary: true,
        roleDescription:
          "Assistant Athletic Director of Marketing and Fan Experience at Boise State Athletics (broncosports.com/staff-directory). Verified deliverable via Hunter SMTP check.",
      },
      {
        fullName: "Lisa Cochran",
        email: "lcochran@boisestate.edu",
        roleTitle: "Executive Director, Boise State Sports & Entertainment Group",
        roleCategory: "events",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 99,
        roleDescription:
          "Executive Director of Boise State Sports & Entertainment Group — oversees live entertainment across Albertsons Stadium and ExtraMile Arena. Verified deliverable via Hunter SMTP check.",
      },
      {
        fullName: "Cameron Howard",
        email: "cameronhoward173@boisestate.edu",
        roleTitle: "Director of Community & Fan Engagement",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 99,
        roleDescription:
          "Director of Community & Fan Engagement at Boise State Athletics. Verified deliverable via Hunter SMTP check.",
      },
    ],
  },
  {
    organizationName: "Vancouver Whitecaps FC",
    alternateNames: ["Whitecaps FC"],
    websiteUrl: "https://www.whitecapsfc.com/",
    locationCity: "Vancouver",
    locationRegion: "BC",
    locationCountry: "CA",
    organizationTypeKey: "sports_team",
    tier: "greater_pnw",
    fanbaseLabel: "Vancouver Whitecaps",
    opportunityTitle: "Fan Chant — Vancouver Whitecaps FC (BC Place Cascadia supporter chants & partner activations)",
    eventOrInitiativeName: "Fan Chant — Whitecaps FC",
    description:
      "Cascadia MLS rival 3 hours north of Seattle at BC Place — strong supporter culture and verified Creative Content & Partnership Marketing directors.",
    potentialAmount: 25_000,
    totalScoreHint: 88,
    contacts: [
      {
        fullName: "Leah Browne",
        email: "lbrowne@whitecapsfc.com",
        roleTitle: "Director of Creative Content",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 95,
        primary: true,
        roleDescription:
          "Director of Creative Content at Vancouver Whitecaps FC — leads creative fan storytelling and matchday content. Verified deliverable via Hunter.",
      },
      {
        fullName: "Claire Villet",
        email: "cvillet@whitecapsfc.com",
        roleTitle: "Director of Partnership Marketing",
        roleCategory: "partnerships",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 95,
        roleDescription:
          "Director of Partnership Marketing at Vancouver Whitecaps FC — connects corporate sponsors with stadium fan moments. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "Vancouver Canucks",
    alternateNames: ["Canucks"],
    websiteUrl: "https://www.nhl.com/canucks",
    locationCity: "Vancouver",
    locationRegion: "BC",
    locationCountry: "CA",
    organizationTypeKey: "sports_team",
    tier: "greater_pnw",
    fanbaseLabel: "Vancouver Canucks",
    opportunityTitle: "Fan Chant — Vancouver Canucks (Rogers Arena live events & fan-sourced hockey chants)",
    eventOrInitiativeName: "Fan Chant — Vancouver Canucks",
    description:
      "Pacific Northwest NHL franchise at Rogers Arena in Vancouver — verified Director of Live Events and Marketing Director.",
    potentialAmount: 30_000,
    totalScoreHint: 88,
    contacts: [
      {
        fullName: "John Kassis",
        email: "john.kassis@canucks.com",
        roleTitle: "Director of Live Events",
        roleCategory: "events",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 99,
        primary: true,
        roleDescription:
          "Director of Live Events at Vancouver Canucks — directly leads live arena entertainment and Rogers Arena event production. Verified deliverable via Hunter.",
      },
      {
        fullName: "Sean Goodall",
        email: "sean.goodall@canucks.com",
        roleTitle: "Marketing Director",
        roleCategory: "marketing",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 98,
        roleDescription:
          "Marketing Director at Vancouver Canucks. Verified deliverable via Hunter.",
      },
    ],
  },
  {
    organizationName: "BC Lions",
    websiteUrl: "https://www.bclions.com/",
    locationCity: "Vancouver",
    locationRegion: "BC",
    locationCountry: "CA",
    organizationTypeKey: "sports_team",
    tier: "greater_pnw",
    fanbaseLabel: "BC Lions",
    opportunityTitle: "Fan Chant — BC Lions (BC Place concert-atmosphere CFL game presentation & fan chants)",
    eventOrInitiativeName: "Fan Chant — BC Lions",
    description:
      "CFL club at BC Place known across North America for concert-grade game presentation and big-crowd fan energy.",
    potentialAmount: 22_000,
    totalScoreHint: 87,
    contacts: [
      {
        fullName: "George Chayka",
        email: "gchayka@bclions.com",
        roleTitle: "Vice President of Business",
        roleCategory: "executive",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 93,
        primary: true,
        roleDescription:
          "Vice President of Business at BC Lions — leads commercial strategy, game-day entertainment growth, and partnerships at BC Place. Verified deliverable via Hunter.",
      },
      {
        fullName: "Carolyn Cody",
        email: "ccody@bclions.com",
        roleTitle: "Vice President of Operations",
        roleCategory: "operations",
        emailVerificationStatus: "verified_deliverable",
        hunterVerifier: "valid",
        hunterConfidence: 91,
        roleDescription:
          "VP of Operations at BC Lions. Verified deliverable via Hunter.",
      },
    ],
  },
];

export function buildPnwSportsPartnerDraft(
  spec: PnwSportsTeamSpec,
  contact: Contact
): { subject: string; body: string } {
  if (/seahawks/i.test(spec.organizationName) || spec.organizationTypeKey === "university") {
    return draftCopyForContact(spec.organizationName, contact, {
      opportunityTypeKey: "fan_engagement_initiative",
      eventName: spec.eventOrInitiativeName,
    });
  }

  const firstName = (contact.fullName ?? "").trim().split(/\s+/)[0] || "there";
  const role = (contact.roleTitle ?? "").toLowerCase();
  const isSeattleLocal = spec.tier === "seattle_metro";
  const geoLine = isSeattleLocal
    ? `I’m Joel DeJong, founder of Crowdsource Choir right here in Seattle. As we look for initial local partner teams in the Puget Sound region, ${spec.organizationName} is right at the top of my list.`
    : `I’m Joel DeJong, founder of Crowdsource Choir up in Seattle. As we build initial partner-team relationships across the Pacific Northwest, ${spec.organizationName} is right at the top of my list.`;

  let ask = `I’d love to connect, share what we’re building here in the Northwest, and explore whether ${spec.organizationName} could be one of our local partner teams — or be pointed to the right person if that’s someone else on your staff.`;
  if (/production|game presentation|live events|entertainment|events/.test(role)) {
    ask = `Given your seat leading live game presentation and events, I’d love to connect and explore how this kind of crowd-created participation could become part of the ${spec.organizationName} gameday show — not just something fans watch, but something they help create.`;
  } else if (/partnerships|sponsorships|commercial/.test(role)) {
    ask = `Given your work leading partnerships, there’s also a natural sponsor story here — a local brand can present the Chant Garden and the live stadium moment while fans author a lasting ${spec.organizationName} tradition. I’d love to connect and explore whether there’s a fit.`;
  } else if (/marketing|brand|community/.test(role)) {
    ask = `Given your work leading brand and fan engagement, I’d love to explore how this could become a season-long participation story — something ${spec.fanbaseLabel ?? spec.organizationName} supporters actively create with the club rather than another campaign directed at them.`;
  }

  return {
    subject: `Crowdsourcing ${spec.organizationName} fan chants`,
    body: [
      `Hi ${firstName},`,
      "",
      geoLine,
      "",
      "We design and deliver participatory music experiences, custom anthems, and crowdsourced chants that turn fans from spectators into the show.",
      "",
      `With ${spec.organizationName}, I see a simple, repeatable season partnership:`,
      "",
      "Between games: Supporters contribute voices, rhythms, and chant ideas through our digital Chant Garden.",
      `Game day: We shape those fan contributions into original ${spec.fanbaseLabel ?? spec.organizationName} chants and anthems — ready for your in-venue team to run or for Crowdsource Choir to lead live.`,
      "Across the season: The strongest moments build into an authentic catalogue of fan-created traditions (with natural room for a presenting sponsor).",
      "",
      ask,
      "",
      "There’s a quick look at Crowdsource Choir here: www.crowdsourcechoir.com",
      "",
      "Best,",
      "Joel",
    ].join("\n"),
  };
}

async function findMatchingOrganization(spec: PnwSportsTeamSpec): Promise<Organization | null> {
  const byPrimary = await findExistingOrganization(spec.organizationName, null);
  if (byPrimary) return byPrimary;
  for (const alt of spec.alternateNames ?? []) {
    const byAlt = await findExistingOrganization(alt, null);
    if (byAlt) return byAlt;
  }
  return null;
}

export type SeedPnwSportsTeamsResult = {
  attempted: number;
  createdOrgs: number;
  updatedOrgs: number;
  contactsCreated: number;
  contactsUpdated: number;
  enqueued: number;
  skippedAlreadyContacted: string[];
  alreadySeeded: number;
  draftedToGmail: number;
  linedUp: number;
  errors: Array<{ name: string; error: string }>;
};

export async function seedPnwSportsPartnerTeams(options?: {
  force?: boolean;
  pushGmailDrafts?: number;
}): Promise<SeedPnwSportsTeamsResult> {
  const force = Boolean(options?.force);
  const nowIso = new Date().toISOString();
  const result: SeedPnwSportsTeamsResult = {
    attempted: PNW_SPORTS_PARTNER_TEAMS.length,
    createdOrgs: 0,
    updatedOrgs: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    enqueued: 0,
    skippedAlreadyContacted: [],
    alreadySeeded: 0,
    draftedToGmail: 0,
    linedUp: 0,
    errors: [],
  };

  for (const spec of PNW_SPORTS_PARTNER_TEAMS) {
    try {
      const existingOrg = await findMatchingOrganization(spec);
      const priorMeta = (existingOrg?.importMetadata ?? {}) as Record<string, unknown>;

      if (existingOrg && priorMeta[PNW_SPORTS_TEAMS_SEEDED_FLAG] === true && !force) {
        result.alreadySeeded += 1;
        continue;
      }

      if (existingOrg?.isExistingClient || priorMeta.doNotProspect === true) {
        result.skippedAlreadyContacted.push(spec.organizationName);
        continue;
      }

      if (existingOrg) {
        const existingOpps = await listOpportunitiesForOrganization(existingOrg.id);
        const existingContacts = await listContactsForOrganization(existingOrg.id);
        const suppression = await loadPriorOutreachSuppression(
          [existingOrg.id],
          existingContacts.map((c) => c.id)
        );
        const hasPriorTouch =
          suppression.contactedOrgIds.has(existingOrg.id) ||
          existingOpps.some((o) => Boolean(o.lastOutboundAt || o.lastInboundAt || o.gmailThreadId));
        if (hasPriorTouch) {
          result.skippedAlreadyContacted.push(existingOrg.name);
          continue;
        }
      }

      const orgType = await findOrganizationTypeByKey(spec.organizationTypeKey);
      const cleanedPriorMeta = { ...priorMeta };
      delete cleanedPriorMeta.holdAutoPipeline;
      delete cleanedPriorMeta.holdAutoPipelineReason;

      const orgMeta = withSalesInitiative(
        {
          ...cleanedPriorMeta,
          revenueEngine: "partnership",
          flagshipOffer: "crowdsource_partnership",
          businessCategory: "commissioned",
          productExperience: "fan_chant",
          dealType: "strategic_partnership",
          pnwSportsTier: spec.tier,
          hunterBackOnlineSweepV1: true,
          [PNW_SPORTS_TEAMS_SEEDED_FLAG]: true,
          pnwSportsPartnerTeamsSeededAt: nowIso,
        },
        "sports_fan_culture"
      );

      let organization: Organization;
      if (!existingOrg) {
        organization = await createOrganization({
          name: spec.organizationName,
          websiteUrl: spec.websiteUrl,
          locationCity: spec.locationCity,
          locationRegion: spec.locationRegion,
          locationCountry: spec.locationCountry,
          organizationTypeId: orgType?.id ?? null,
          source: "manual",
          isExistingClient: false,
          importMetadata: orgMeta,
        });
        result.createdOrgs += 1;
      } else {
        organization = await updateOrganization(existingOrg.id, {
          websiteUrl: existingOrg.websiteUrl ?? spec.websiteUrl,
          locationCity: spec.locationCity || existingOrg.locationCity,
          locationRegion: spec.locationRegion || existingOrg.locationRegion,
          locationCountry: spec.locationCountry || existingOrg.locationCountry,
          organizationTypeId: existingOrg.organizationTypeId ?? orgType?.id ?? null,
          importMetadata: orgMeta,
        });
        result.updatedOrgs += 1;
      }

      // Check contact-level suppression before adding/selecting contacts
      const suppression = await loadPriorOutreachSuppression([organization.id], []);
      let primaryContactId: string | null = null;

      for (const cSpec of spec.contacts) {
        const normEmail = normalizeEmail(cSpec.email);
        if (normEmail && suppression.contactedEmails.has(normEmail)) {
          continue;
        }
        const contactMeta = {
          hunterDomainSearch: true,
          hunterConfidence: cSpec.hunterConfidence,
          hunterVerifier: cSpec.hunterVerifier,
          roleDescription: cSpec.roleDescription,
        };
        const existingContact = await findExistingContact(
          organization.id,
          cSpec.email,
          cSpec.fullName
        );
        let saved: Contact;
        if (existingContact) {
          saved = await updateContact(existingContact.id, {
            fullName: cSpec.fullName,
            roleTitle: cSpec.roleTitle,
            roleCategory: cSpec.roleCategory,
            email: cSpec.email,
            emailVerificationStatus: cSpec.emailVerificationStatus,
            importMetadata: {
              ...((existingContact.importMetadata as Record<string, unknown> | null) ?? {}),
              ...contactMeta,
            },
          });
          result.contactsUpdated += 1;
        } else {
          saved = await createContact({
            organizationId: organization.id,
            fullName: cSpec.fullName,
            roleTitle: cSpec.roleTitle,
            roleCategory: cSpec.roleCategory,
            email: cSpec.email,
            source: "ai_discovered",
            emailVerificationStatus: cSpec.emailVerificationStatus,
            importMetadata: contactMeta,
          });
          result.contactsCreated += 1;
        }
        if (cSpec.primary || !primaryContactId) {
          primaryContactId = saved.id;
        }
      }

      // Reuse an existing uncontacted Fan Chant opportunity if seedSeattleSportsPartners created a shell earlier
      const existingOpps = await listOpportunitiesForOrganization(organization.id);
      const reusableOpp = existingOpps.find(
        (o) =>
          o.status !== "rejected" &&
          o.status !== "duplicate" &&
          !o.lastOutboundAt &&
          !o.lastInboundAt &&
          !o.gmailThreadId
      );

      const effectiveTitle = reusableOpp ? reusableOpp.title : spec.opportunityTitle;

      const manual = await enqueueOrgManually({
        organization,
        title: effectiveTitle,
        description: spec.description,
        eventOrInitiativeName: spec.eventOrInitiativeName,
        opportunityTypeKey: "fan_engagement_initiative",
        totalScoreHint: spec.totalScoreHint,
      });

      const reloadedOrg = await getOrganization(organization.id);
      if (reloadedOrg) {
        await updateOrganization(organization.id, {
          importMetadata: {
            ...(reloadedOrg.importMetadata ?? {}),
            ...orgMeta,
            operatorQueuedAt: nowIso,
          },
        });
      }

      const opp = await getOpportunity(manual.opportunityId);
      await updateOpportunityImportMetadata(manual.opportunityId, {
        ...(opp?.importMetadata ?? {}),
        enqueuedManually: true,
        salesInitiative: "sports_fan_culture",
        revenueEngine: "partnership",
        flagshipOffer: "crowdsource_partnership",
        businessCategory: "commissioned",
        productExperience: "fan_chant",
        dealType: "strategic_partnership",
        suggestedAnthemFee: spec.potentialAmount,
        potentialAmount: spec.potentialAmount,
        pricingCategory: "sports",
        pricingTier: "season_partnership",
        pricingConfidence: "medium",
        pricingRationale: "Seattle / Pacific Northwest local partner team Fan Chant & season-long game-day participation program.",
        pricingEvaluatedAt: nowIso,
        pricingFrameworkVersion: PRICING_FRAMEWORK_VERSION,
        pnwSportsTier: spec.tier,
        [PNW_SPORTS_TEAMS_SEEDED_FLAG]: true,
      });

      const allContacts = await listContactsForOrganization(organization.id);
      const contactById = new Map(allContacts.map((c) => [c.id, c]));
      const drafts = await listDraftsForOpportunity(manual.opportunityId);
      let primaryDraftId: string | null = null;

      for (const draft of drafts) {
        if (draft.kind !== "initial" || !draft.contactId) continue;
        const c = contactById.get(draft.contactId);
        if (!c?.fullName) continue;
        if (
          (draft.status === "draft" || draft.status === "qa_flagged") &&
          draft.editedSubject == null &&
          draft.editedBody == null
        ) {
          const copy = buildPnwSportsPartnerDraft(spec, c);
          await updateDraftAiCopy(draft.id, {
            aiSubject: copy.subject,
            aiBody: copy.body,
          });
        }
        if (draft.contactId === primaryContactId) {
          primaryDraftId = draft.id;
        }
      }

      if (primaryDraftId && primaryDraftId !== manual.outreachDraftId) {
        await createOrUpdateQueueItem({
          opportunityId: manual.opportunityId,
          outreachDraftId: primaryDraftId,
          prospectScoreId: manual.prospectScoreId,
          touchCreatedAt: true,
        });
      }

      result.enqueued += 1;
    } catch (err) {
      result.errors.push({
        name: spec.organizationName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const pushCount = options?.pushGmailDrafts ?? 0;
  if (pushCount > 0) {
    const tick = await tickAutoSend(new Date(), { maxToDraft: pushCount, forceWhenPaused: false }).catch(
      () => null
    );
    if (tick) {
      result.draftedToGmail = tick.drafted;
      result.linedUp = tick.linedUp;
    }
  } else {
    const refreshed = await refreshAutoSendPlan().catch(() => null);
    if (refreshed) {
      result.linedUp = refreshed.state.slots.filter((s) => s.status === "queued").length;
    }
  }

  return result;
}

export async function getPnwSportsPartnerTeamsSeedStatus(): Promise<{
  expected: number;
  present: number;
  seededOrContacted: number;
  done: boolean;
  teams: Array<{
    name: string;
    tier: PnwSportsTeamSpec["tier"];
    city: string;
    region: string;
    present: boolean;
    markedSeeded: boolean;
    alreadyContacted: boolean;
    contactCount: number;
  }>;
}> {
  const teams: Array<{
    name: string;
    tier: PnwSportsTeamSpec["tier"];
    city: string;
    region: string;
    present: boolean;
    markedSeeded: boolean;
    alreadyContacted: boolean;
    contactCount: number;
  }> = [];

  for (const spec of PNW_SPORTS_PARTNER_TEAMS) {
    const existing = await findMatchingOrganization(spec);
    if (!existing) {
      teams.push({
        name: spec.organizationName,
        tier: spec.tier,
        city: spec.locationCity,
        region: spec.locationRegion,
        present: false,
        markedSeeded: false,
        alreadyContacted: false,
        contactCount: 0,
      });
      continue;
    }
    const meta = (existing.importMetadata ?? {}) as Record<string, unknown>;
    const opps = await listOpportunitiesForOrganization(existing.id);
    const contacts = (await listContactsForOrganization(existing.id)).filter((c) => !c.duplicateOfContactId);
    const alreadyContacted =
      Boolean(existing.isExistingClient || meta.doNotProspect === true) ||
      opps.some((o) => Boolean(o.lastOutboundAt || o.lastInboundAt || o.gmailThreadId));
    teams.push({
      name: existing.name,
      tier: spec.tier,
      city: existing.locationCity ?? spec.locationCity,
      region: existing.locationRegion ?? spec.locationRegion,
      present: true,
      markedSeeded: meta[PNW_SPORTS_TEAMS_SEEDED_FLAG] === true,
      alreadyContacted,
      contactCount: contacts.length,
    });
  }

  const present = teams.filter((t) => t.present).length;
  const seededOrContacted = teams.filter((t) => t.markedSeeded || t.alreadyContacted).length;
  return {
    expected: PNW_SPORTS_PARTNER_TEAMS.length,
    present,
    seededOrContacted,
    done: seededOrContacted === PNW_SPORTS_PARTNER_TEAMS.length,
    teams,
  };
}
