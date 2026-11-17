import type { SalesInitiativeKey } from "../initiatives";

/**
 * Every partner listed on https://seattlesports.org/partners (scraped 2026-11-12).
 * Logo-only tiles are included; the page's visible text misses most of them.
 *
 * Two listings are the same organization and are stored once:
 * - Ballard Spahr (event + patron; the page still says "Ballard Spahr Lane Powell")
 * - King County Play Equity Coalition (also listed as "Play Equity")
 *
 * Brands, venues, media, producers, and community groups are sponsor prospects:
 * Fan Chant first, with room to underwrite something beyond sports.
 * Pro teams and university athletics are Fan Chant season partners, not brand sponsors.
 */

export const SSC_PARTNERS_SOURCE_URL = "https://seattlesports.org/partners";

export const SSC_PARTNER_TIERS = [
  "presenting",
  "official",
  "event",
  "legacy",
  "patron",
  "team",
  "university",
] as const;

export type SscPartnerTier = (typeof SSC_PARTNER_TIERS)[number];

export type SscPartnerLane =
  | "brand"
  | "beverage"
  | "venue"
  | "hospitality"
  | "media"
  | "experience"
  | "community"
  | "team"
  | "university";

export type SscPartner = {
  name: string;
  /** Exact strings on the SSC page when they differ from `name`. Not used for CRM lookup. */
  pageLabels?: string[];
  /** Extra names safe to match in the CRM. Short generic words stay in pageLabels only. */
  aliases?: string[];
  websiteUrl: string;
  tiers: SscPartnerTier[];
  lane: SscPartnerLane;
  organizationTypeKey: string;
  locationCity?: string;
  /** Extra sentence when the generic lane note would miss the point. */
  fitNote?: string;
};

/**
 * Hosts shared by more than one real organization. Domain lookup would merge them
 * (Marriott hotels, league sites, the Commission's own foundation page).
 */
export const SSC_SHARED_PLATFORM_DOMAINS = new Set([
  "marriott.com",
  "hilton.com",
  "nhl.com",
  "mlb.com",
  "thepwhl.com",
  "seattlesports.org",
]);

const TIER_LABEL: Record<SscPartnerTier, string> = {
  presenting: "Presenting Partner",
  official: "Official Partner",
  event: "Event Partner",
  legacy: "Legacy Partner",
  patron: "Patron Partner",
  team: "Team Partner",
  university: "University Partner",
};

export const SEATTLE_SPORTS_PARTNERS: SscPartner[] = [
  // Presenting
  {
    name: "Kaiser Permanente",
    pageLabels: ["Kaiser"],
    aliases: ["Kaiser"],
    websiteUrl: "https://healthy.kaiserpermanente.org/",
    tiers: ["presenting"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Sound Transit",
    websiteUrl: "https://www.soundtransit.org/",
    tiers: ["presenting"],
    lane: "brand",
    organizationTypeKey: "other",
    fitNote: "A public agency. The fit is a civic or fan moment they can underwrite, not a consumer-brand campaign.",
  },
  {
    name: "Amazon",
    websiteUrl: "https://www.amazon.com/",
    tiers: ["presenting"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Port of Seattle",
    websiteUrl: "https://www.portseattle.org/",
    tiers: ["presenting"],
    lane: "brand",
    organizationTypeKey: "other",
    fitNote: "A public port. The fit is a visitor or game-day welcome moment, and it can extend to a waterfront gathering.",
  },
  {
    name: "AT&T",
    websiteUrl: "https://www.att.com/",
    tiers: ["presenting"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Microsoft",
    websiteUrl: "https://www.microsoft.com/",
    tiers: ["presenting"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "WM",
    aliases: ["Waste Management"],
    websiteUrl: "https://www.wm.com/",
    tiers: ["presenting"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },

  // Official
  {
    name: "Seattle Convention Center",
    websiteUrl: "https://seattleconventioncenter.com/",
    tiers: ["official"],
    lane: "venue",
    organizationTypeKey: "venue",
  },
  {
    name: "Gensler",
    websiteUrl: "https://www.gensler.com/",
    tiers: ["official"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "EY",
    pageLabels: ["Ernst & Young"],
    aliases: ["Ernst & Young", "Ernst and Young"],
    websiteUrl: "https://www.ey.com/en_us",
    tiers: ["official"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },

  // Event
  {
    name: "Alabastro Photography",
    pageLabels: ["Alabastro"],
    websiteUrl: "https://www.alabastrophoto.com/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "Alaska Airlines",
    websiteUrl: "https://www.alaskaair.com/",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Bank of America",
    websiteUrl: "https://www.bankofamerica.com/",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "BizX",
    pageLabels: ["Bizx"],
    websiteUrl: "https://www.bizx.com/",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
    fitNote: "BizX is a business barter exchange, so an in-kind sponsorship is as plausible as cash.",
  },
  {
    name: "Ballard Spahr",
    pageLabels: ["Ballard Spahr Lane Powell"],
    aliases: ["Ballard Spahr Lane Powell"],
    websiteUrl: "https://www.ballardspahr.com/",
    tiers: ["event", "patron"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Gallo",
    aliases: ["E. & J. Gallo Winery"],
    websiteUrl: "https://www.gallo.com/",
    tiers: ["event"],
    lane: "beverage",
    organizationTypeKey: "corporation",
  },
  {
    name: "KPMG",
    websiteUrl: "https://kpmg.com/us/en.html",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "iHeartMedia",
    pageLabels: ["IHeartMedia"],
    websiteUrl: "https://www.iheartmedia.com/",
    tiers: ["event"],
    lane: "media",
    organizationTypeKey: "corporation",
  },
  {
    name: "Hyatt",
    websiteUrl: "https://www.hyatt.com/",
    tiers: ["event"],
    lane: "hospitality",
    organizationTypeKey: "venue",
  },
  {
    name: "KING 5",
    websiteUrl: "https://www.king5.com/",
    tiers: ["event"],
    lane: "media",
    organizationTypeKey: "corporation",
  },
  {
    name: "FOX 13 Seattle",
    pageLabels: ["FOX 13"],
    websiteUrl: "https://www.fox13seattle.com/",
    tiers: ["event"],
    lane: "media",
    organizationTypeKey: "corporation",
  },
  {
    name: "Les Schwab",
    websiteUrl: "https://www.lesschwab.com/",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "King County Play Equity Coalition",
    pageLabels: ["Play Equity"],
    aliases: ["Play Equity"],
    websiteUrl: "https://www.kcplayequity.org/",
    tiers: ["event"],
    lane: "community",
    organizationTypeKey: "nonprofit",
    fitNote: "Listed twice on the page, as Play Equity and under the full coalition name.",
  },
  {
    name: "PNC",
    websiteUrl: "https://www.pnc.com/",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Snoqualmie Casino",
    websiteUrl: "https://www.snocasino.com/",
    tiers: ["event"],
    lane: "venue",
    organizationTypeKey: "venue",
  },
  {
    name: "Seattle Sports Commission Foundation",
    pageLabels: ["SSC Foundation"],
    aliases: ["SSC Foundation"],
    websiteUrl: "https://www.seattlesports.org/foundation",
    tiers: ["event"],
    lane: "community",
    organizationTypeKey: "nonprofit",
    fitNote:
      "This is the Commission's own foundation. Treat it as a collaborator on youth and community sports, not as a brand writing a presenting check.",
  },
  {
    name: "MTR Western",
    pageLabels: ["MTRWestern"],
    aliases: ["MTRWestern"],
    websiteUrl: "http://www.mtrwestern.com/",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Story Fruition",
    websiteUrl: "https://www.storyfruition.com/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "Washington Athletic Club",
    websiteUrl: "https://www.wac.net/",
    tiers: ["event"],
    lane: "venue",
    organizationTypeKey: "venue",
  },
  {
    name: "Tagboard",
    pageLabels: ["tagboard"],
    websiteUrl: "https://tagboard.com/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
    fitNote: "Tagboard already puts fan posts on arena boards, so a Fan Chant is a live version of participation they know how to stage.",
  },
  {
    name: "Sign Dog",
    websiteUrl: "https://signdog.com/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "T-Mobile",
    websiteUrl: "https://www.t-mobile.com/",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Swire Coca-Cola",
    websiteUrl: "https://www.swirecc.com/",
    tiers: ["event"],
    lane: "beverage",
    organizationTypeKey: "corporation",
  },
  {
    name: "Symetra",
    websiteUrl: "https://www.symetra.com/",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Tokita Bethune",
    pageLabels: ["tokitabethune"],
    websiteUrl: "https://www.tokitabethune.com/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "SRTC Limo Worldwide",
    websiteUrl: "https://www.srtclimo.com/",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Seattle Metropolitan Chamber of Commerce",
    websiteUrl: "https://www.seattlechamber.com/",
    tiers: ["event"],
    lane: "community",
    organizationTypeKey: "association",
  },
  {
    name: "Climate Pledge Arena",
    websiteUrl: "https://climatepledgearena.com/",
    tiers: ["event"],
    lane: "venue",
    organizationTypeKey: "venue",
  },
  {
    name: "Bale Breaker",
    websiteUrl: "https://balebreaker.com/",
    tiers: ["event"],
    lane: "beverage",
    organizationTypeKey: "corporation",
  },
  {
    name: "MetaMora Productions",
    pageLabels: ["MetaMora Productions Inc."],
    aliases: ["MetaMora Productions Inc."],
    websiteUrl: "https://www.metamoraproductions.com/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "Keegan Hall",
    websiteUrl: "https://keeganhall.com/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "Alexander Global Promotions",
    websiteUrl: "https://www.alexanderglobal.com/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "Upchurch Vineyard",
    pageLabels: ["Upchurch"],
    websiteUrl: "https://www.upchurchvineyard.com/",
    tiers: ["event"],
    lane: "beverage",
    organizationTypeKey: "corporation",
  },
  {
    name: "Element Seattle Downtown",
    pageLabels: ["Element Hotel by Westin"],
    aliases: ["Element Hotel by Westin", "Element Seattle"],
    websiteUrl: "https://www.marriott.com/en-us/hotels/seaen-element-seattle-downtown/overview/",
    tiers: ["event"],
    lane: "hospitality",
    organizationTypeKey: "venue",
  },
  {
    name: "Tinte Cellars",
    pageLabels: ["Tinte"],
    websiteUrl: "https://tintecellars.com/",
    tiers: ["event"],
    lane: "beverage",
    organizationTypeKey: "corporation",
  },
  {
    name: "Comcast",
    websiteUrl: "https://corporate.comcast.com/",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Seattle Center",
    websiteUrl: "https://seattlecenter.com/",
    tiers: ["event"],
    lane: "venue",
    organizationTypeKey: "venue",
  },
  {
    name: "Ivar's",
    websiteUrl: "https://www.ivars.com/",
    tiers: ["event"],
    lane: "hospitality",
    organizationTypeKey: "corporation",
  },
  {
    name: "The Edgewater Hotel",
    websiteUrl: "https://www.edgewaterhotel.com/",
    tiers: ["event"],
    lane: "hospitality",
    organizationTypeKey: "venue",
  },
  {
    name: "Conviva",
    pageLabels: ["Conviva AI"],
    aliases: ["Conviva AI"],
    websiteUrl: "https://www.convivaai.com/",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
    fitNote: "Sports is how they know Seattle. The product is technology, so the offer can also be a participatory moment at a company or client gathering.",
  },
  {
    name: "Seattle Opera",
    websiteUrl: "https://www.seattleopera.org/",
    tiers: ["event"],
    lane: "community",
    organizationTypeKey: "nonprofit",
    fitNote: "The beyond-sports path is the interesting one: a participatory anthem or Rave Choir moment. Fan Chant is the sports door because they already partner with SSC.",
  },
  {
    name: "Embassy Suites by Hilton Seattle Bellevue",
    pageLabels: ["Hilton Embassy Suites"],
    aliases: ["Hilton Embassy Suites", "Embassy Suites Seattle Bellevue"],
    websiteUrl: "https://www.hilton.com/en/hotels/seables-embassy-suites-seattle-bellevue/",
    tiers: ["event"],
    lane: "hospitality",
    organizationTypeKey: "venue",
    locationCity: "Bellevue",
  },
  {
    name: "PCL Construction",
    websiteUrl: "https://www.pcl.com/us/en",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Washington State Golf Association",
    pageLabels: ["WA Golf"],
    aliases: ["WA Golf"],
    websiteUrl: "https://wagolf.org/",
    tiers: ["event"],
    lane: "community",
    organizationTypeKey: "association",
  },
  {
    name: "Residence Inn Seattle Downtown Convention Center",
    pageLabels: ["Residence INN Seattle Downtown/Convention Center"],
    aliases: ["Residence Inn Seattle Downtown/Convention Center"],
    websiteUrl: "https://www.marriott.com/en-us/hotels/seaav-residence-inn-seattle-downtown-convention-center/overview/",
    tiers: ["event"],
    lane: "hospitality",
    organizationTypeKey: "venue",
  },
  {
    name: "Moxy Seattle Downtown",
    pageLabels: ["Moxy Hotel"],
    aliases: ["Moxy Hotel", "Moxy Seattle"],
    websiteUrl: "https://www.marriott.com/en-us/hotels/seaox-moxy-seattle-downtown/overview/",
    tiers: ["event"],
    lane: "hospitality",
    organizationTypeKey: "venue",
  },
  {
    name: "Esterre",
    websiteUrl: "https://www.esterre.com/",
    tiers: ["event"],
    lane: "hospitality",
    organizationTypeKey: "corporation",
    fitNote: "Seattle shared-ownership vacation homes. A fit beyond the arena is a gathering of owners, with Fan Chant as the sports door they already bought.",
  },
  {
    name: "Talking Rain",
    websiteUrl: "https://talkingrain.com/",
    tiers: ["event"],
    lane: "beverage",
    organizationTypeKey: "corporation",
    locationCity: "Preston",
  },
  {
    name: "KOMO News",
    pageLabels: ["KOMO 4"],
    aliases: ["KOMO 4", "KOMO"],
    websiteUrl: "https://komonews.com/",
    tiers: ["event"],
    lane: "media",
    organizationTypeKey: "corporation",
  },
  {
    name: "GIAN Events",
    websiteUrl: "https://www.gianevents.com/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "The Hall Group",
    pageLabels: ["The Hall"],
    websiteUrl: "https://thehall.group/",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Space Needle",
    websiteUrl: "https://www.spaceneedle.com/",
    tiers: ["event"],
    lane: "venue",
    organizationTypeKey: "venue",
  },
  {
    name: "CORT Party Rental",
    pageLabels: ["CORT"],
    websiteUrl: "https://www.cortpartyrental.com/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "YMCA of Greater Seattle",
    pageLabels: ["YMCA"],
    aliases: ["Seattle YMCA"],
    websiteUrl: "https://www.seattleymca.org/",
    tiers: ["event"],
    lane: "community",
    organizationTypeKey: "nonprofit",
  },
  {
    name: "Vino FC",
    websiteUrl: "https://www.vinofc.com/",
    tiers: ["event"],
    lane: "beverage",
    organizationTypeKey: "corporation",
    fitNote: "Vino FC already mixes wine and soccer. A fan ritual is closer to their product than a sideline logo.",
  },
  {
    name: "Simply Seattle",
    websiteUrl: "https://www.simplyseattle.com/",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "VIA Creatives",
    websiteUrl: "https://www.viacreatives.com/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "MVP Photo Booth",
    websiteUrl: "https://www.mvpphotobooth.com/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "BDA",
    websiteUrl: "https://www.bdainc.com/",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Concierge Nurse Services",
    websiteUrl: "https://www.conciergenursingseattle.com/",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Ignite Designs NW",
    websiteUrl: "https://ignitedesignsnw.com/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "MARQ",
    pageLabels: ["Marq"],
    websiteUrl: "https://www.thelsstudio.com/marq",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "J. Fields DJ Entertainment",
    websiteUrl: "https://musicbyjfields.com/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "Sarah's Celebrations",
    websiteUrl: "https://sarahscelebrationsseattle.com/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "SJ Catering & Events",
    websiteUrl: "https://www.suitejcatering.com/",
    tiers: ["event"],
    lane: "hospitality",
    organizationTypeKey: "corporation",
  },
  {
    name: "Kaneri Films",
    websiteUrl: "https://kaneri.co/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "Moment.Us",
    pageLabels: ["Moment.us"],
    websiteUrl: "https://www.makeitmoment.us/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "Intrepid Travel",
    pageLabels: ["Intrepid"],
    websiteUrl: "https://www.intrepidtravel.com/us",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Seattle Top Tix",
    websiteUrl: "https://seattletoptix.com/",
    tiers: ["event"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "Going Twice",
    websiteUrl: "https://www.goingtwice.com/",
    tiers: ["event"],
    lane: "brand",
    organizationTypeKey: "corporation",
    fitNote: "Going Twice sells sports cards and fan collectibles, so the relationship is fan culture even if the first check is a small activation.",
  },

  // Legacy
  {
    name: "TriFilm",
    pageLabels: ["Trifilm"],
    websiteUrl: "https://www.trifilm.com/",
    tiers: ["legacy"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "Fearey Group",
    pageLabels: ["Feary Group"],
    aliases: ["Feary Group", "The Fearey Group"],
    websiteUrl: "https://fearey.agency/",
    tiers: ["legacy"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "Encore Global",
    pageLabels: ["Encore"],
    aliases: ["Encore Global"],
    websiteUrl: "https://www.encoreglobal.com/",
    tiers: ["legacy"],
    lane: "experience",
    organizationTypeKey: "event_agency",
  },
  {
    name: "Phishgrad",
    websiteUrl: "https://phishgrad.com/",
    tiers: ["legacy"],
    lane: "brand",
    organizationTypeKey: "corporation",
    fitNote: "Sports is the SSC relationship. The product is technology, so a participatory moment at a company or client gathering is in bounds too.",
  },
  {
    name: "Brooks Running",
    websiteUrl: "https://www.brooksrunning.com/",
    tiers: ["legacy"],
    lane: "brand",
    organizationTypeKey: "corporation",
    fitNote: "Brooks is a sport brand. A chant or participatory warm-up is closer to the product than a logo on a board.",
  },
  {
    name: "Madak",
    websiteUrl: "https://www.madak.com/",
    tiers: ["legacy"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Cutter & Buck",
    websiteUrl: "https://www.cutterbuck.com/",
    tiers: ["legacy"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Net-Tech",
    pageLabels: ["Net Tech"],
    aliases: ["Net Tech"],
    websiteUrl: "https://www.net-tech.com/",
    tiers: ["legacy"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },

  // Patron (Ballard Spahr is already listed under event)
  {
    name: "Brighton Jones",
    websiteUrl: "https://www.brightonjones.com/",
    tiers: ["patron"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Level Seattle South Lake Union",
    pageLabels: ["Level Hotel"],
    aliases: ["Level Hotel", "Level Seattle"],
    websiteUrl: "https://stayinglevel.com/destinations/seattle/south-lake-union",
    tiers: ["patron"],
    lane: "hospitality",
    organizationTypeKey: "venue",
  },
  {
    name: "The Westin Seattle",
    pageLabels: ["The Westin"],
    aliases: ["Westin Seattle"],
    websiteUrl: "https://www.marriott.com/en-us/hotels/seawi-the-westin-seattle/overview/",
    tiers: ["patron"],
    lane: "hospitality",
    organizationTypeKey: "venue",
  },
  {
    name: "Mortenson",
    websiteUrl: "https://www.mortenson.com/",
    tiers: ["patron"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "WaFd Bank",
    pageLabels: ["WaFd"],
    aliases: ["WaFd"],
    websiteUrl: "https://www.wafdbank.com/",
    tiers: ["patron"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Slalom",
    websiteUrl: "https://www.slalom.com/",
    tiers: ["patron"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Kimley-Horn",
    pageLabels: ["Kimley Horn"],
    aliases: ["Kimley Horn"],
    websiteUrl: "https://www.kimley-horn.com/",
    tiers: ["patron"],
    lane: "brand",
    organizationTypeKey: "corporation",
  },
  {
    name: "Special Olympics Washington",
    pageLabels: ["SOWA"],
    aliases: ["SOWA", "Special Olympics Washington"],
    websiteUrl: "https://www.specialolympicswashington.org/",
    tiers: ["patron"],
    lane: "community",
    organizationTypeKey: "nonprofit",
    fitNote: "Athletes and families are the participants. A chant they help make fits the mission better than a sideline sponsorship.",
  },

  // Teams — Fan Chant season partners
  {
    name: "Seattle Kraken",
    pageLabels: ["Kraken"],
    websiteUrl: "https://www.nhl.com/kraken",
    tiers: ["team"],
    lane: "team",
    organizationTypeKey: "sports_team",
  },
  {
    name: "Seattle Mariners",
    pageLabels: ["Mariners"],
    websiteUrl: "https://www.mlb.com/mariners",
    tiers: ["team"],
    lane: "team",
    organizationTypeKey: "sports_team",
  },
  {
    name: "Seattle Orcas",
    pageLabels: ["Orcas"],
    websiteUrl: "https://www.seattleorcas.com/",
    tiers: ["team"],
    lane: "team",
    organizationTypeKey: "sports_team",
  },
  {
    name: "Seattle Reign FC",
    pageLabels: ["Reign FC"],
    aliases: ["OL Reign"],
    websiteUrl: "https://www.reignfc.com/",
    tiers: ["team"],
    lane: "team",
    organizationTypeKey: "sports_team",
  },
  {
    name: "Seattle Seahawks",
    pageLabels: ["Seahawks"],
    websiteUrl: "https://www.seahawks.com/",
    tiers: ["team"],
    lane: "team",
    organizationTypeKey: "sports_team",
  },
  {
    name: "Seattle Seawolves",
    pageLabels: ["Seawolves"],
    websiteUrl: "https://www.seattleseawolves.com/",
    tiers: ["team"],
    lane: "team",
    organizationTypeKey: "sports_team",
  },
  {
    name: "Seattle Sounders FC",
    pageLabels: ["Sounders FC"],
    aliases: ["Seattle Sounders"],
    websiteUrl: "https://www.soundersfc.com/",
    tiers: ["team"],
    lane: "team",
    organizationTypeKey: "sports_team",
  },
  {
    name: "Seattle Storm",
    pageLabels: ["Storm"],
    websiteUrl: "https://storm.wnba.com/",
    tiers: ["team"],
    lane: "team",
    organizationTypeKey: "sports_team",
  },
  {
    name: "Seattle Torrent",
    pageLabels: ["Torrent"],
    websiteUrl: "https://www.thepwhl.com/en/teams/seattle-torrent",
    tiers: ["team"],
    lane: "team",
    organizationTypeKey: "sports_team",
  },

  // Universities
  {
    name: "University of Washington Athletics",
    websiteUrl: "https://gohuskies.com/",
    tiers: ["university"],
    lane: "university",
    organizationTypeKey: "university",
  },
  {
    name: "Washington State University Athletics",
    pageLabels: ["WSU Cougars"],
    aliases: ["WSU Cougars", "WSU Athletics"],
    websiteUrl: "https://wsucougars.com/",
    tiers: ["university"],
    lane: "university",
    organizationTypeKey: "university",
  },
  {
    name: "Seattle University Athletics",
    pageLabels: ["Seattle University"],
    websiteUrl: "https://goseattleu.com/",
    tiers: ["university"],
    lane: "university",
    organizationTypeKey: "university",
  },
];

/** Whether this SSC row should set the sales initiative and own the Fan Chant opportunity. */
export function shouldClaimSscPartner(input: {
  exists: boolean;
  isExistingClient: boolean;
  doNotProspect: boolean;
  currentInitiative: string | null;
  desiredInitiative: string;
  activeOpportunityCount: number;
}): boolean {
  if (input.isExistingClient || input.doNotProspect) return false;
  if (!input.exists) return true;
  if (input.currentInitiative === input.desiredInitiative) return true;
  return input.currentInitiative === null && input.activeOpportunityCount === 0;
}

export function sscPartnerLabels(partner: SscPartner): string[] {
  return [partner.name, ...(partner.pageLabels ?? []), ...(partner.aliases ?? [])];
}

export function sscSalesInitiative(partner: SscPartner): SalesInitiativeKey {
  return partner.lane === "team" || partner.lane === "university" ? "sports_fan_culture" : "sponsor_partners";
}

export function sscOpportunityTypeKey(partner: SscPartner): "fan_engagement_initiative" | "other" {
  return partner.lane === "team" || partner.lane === "university" ? "fan_engagement_initiative" : "other";
}

export function sscOpportunityTitle(partner: SscPartner): string {
  return partner.lane === "team" || partner.lane === "university"
    ? `Fan Chant — ${partner.name}`
    : `Fan Chant sponsor — ${partner.name}`;
}

export function sscTargetRole(partner: SscPartner): string {
  switch (partner.lane) {
    case "team":
      return "Fan experience, game presentation, or partnerships";
    case "university":
      return "Athletics marketing or fan experience";
    case "media":
      return "Sports partnerships or marketing";
    case "venue":
    case "hospitality":
      return "Events or partnerships";
    case "experience":
      return "Partnerships or experiential production";
    case "community":
      return "Partnerships or development";
    default:
      return "Sponsorships or brand partnerships";
  }
}

function tierPhrase(tiers: SscPartnerTier[]): string {
  return tiers.map((tier) => TIER_LABEL[tier]).join(" and ");
}

export function sscPartnerFit(partner: SscPartner): string {
  const lead = `${partner.name} is a Seattle Sports Commission ${tierPhrase(partner.tiers)} (${SSC_PARTNERS_SOURCE_URL}). They already put money or reputation into Seattle sports.`;
  const expand =
    "The same relationship can grow past the game: a Rave Choir presenting partner, an original anthem, or another participatory Crowdsource experience.";
  let body: string;
  switch (partner.lane) {
    case "team":
      body =
        "Primary fit is Fan Chant: a season of original, fan-built chants and in-game participatory moments. A sponsor-backed activation can sit next to a team commission.";
      break;
    case "university":
      body =
        "Primary fit is Fan Chant with athletics — student section, game-day chants, and a season-long participation loop. Campus gatherings outside sports are a later path.";
      break;
    case "media":
      body =
        "Primary fit is sponsoring or amplifying a Fan Chant — a broadcast, social, or in-venue participatory chant the audience helps create.";
      break;
    case "venue":
      body =
        "Primary fit is hosting or underwriting a Fan Chant in the building, around a Seattle team or a Seattle Sports Commission event.";
      break;
    case "hospitality":
      body =
        "Primary fit is a Fan Chant tied to game-day hospitality, a team stay, or a Seattle Sports Commission gathering they already touch.";
      break;
    case "experience":
      body =
        "Primary fit is placing or co-producing a Fan Chant with a team, venue, or Seattle Sports Commission event they already serve.";
      break;
    case "community":
      body =
        "Primary fit is a participatory sports moment — Fan Chant or a community chant — aligned with youth, equity, or civic sports.";
      break;
    case "beverage":
      body = "Primary fit is underwriting a Fan Chant or in-venue participatory moment where their product already meets fans.";
      break;
    default:
      body =
        "Primary fit is sponsoring a Fan Chant: fans contribute the chant, and the brand is attached to a moment people make together.";
  }
  const note = partner.fitNote ? ` ${partner.fitNote}` : "";
  return `${lead} ${body}${note} ${expand}`;
}
