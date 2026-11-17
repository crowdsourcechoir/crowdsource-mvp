import assert from "node:assert/strict";
import { extractDomain, normalizeOrgName } from "../dedupe";
import { classifyQueueCategory } from "../queue/category";
import { isHeldFromAutoPipeline } from "../prospecting/hold-auto-pipeline";
import { classifyWorkstream } from "../strategy/playbook";
import {
  SEATTLE_SPORTS_PARTNERS,
  SSC_PARTNERS_SOURCE_URL,
  SSC_SHARED_PLATFORM_DOMAINS,
  sscOpportunityTitle,
  sscOpportunityTypeKey,
  sscPartnerFit,
  sscPartnerLabels,
  sscSalesInitiative,
  shouldClaimSscPartner,
} from "./seattle-sports-partners";

/** Exact labels from https://seattlesports.org/partners on 2026-11-12. */
const PAGE_LABELS = [
  "Kaiser",
  "Sound Transit",
  "Amazon",
  "Port of Seattle",
  "AT&T",
  "Microsoft",
  "WM",
  "Seattle Convention Center",
  "Gensler",
  "Ernst & Young",
  "Alabastro",
  "Alaska Airlines",
  "Bank of America",
  "Bizx",
  "Ballard Spahr Lane Powell",
  "Gallo",
  "KPMG",
  "IHeartMedia",
  "Hyatt",
  "KING 5",
  "FOX 13",
  "Les Schwab",
  "Play Equity",
  "PNC",
  "Snoqualmie Casino",
  "SSC Foundation",
  "MTRWestern",
  "Story Fruition",
  "Washington Athletic Club",
  "tagboard",
  "Sign Dog",
  "T-Mobile",
  "Swire Coca-Cola",
  "Symetra",
  "tokitabethune",
  "SRTC Limo Worldwide",
  "Seattle Metropolitan Chamber of Commerce",
  "Climate Pledge Arena",
  "Bale Breaker",
  "MetaMora Productions Inc.",
  "Keegan Hall",
  "King County Play Equity Coalition",
  "Alexander Global Promotions",
  "Upchurch",
  "Element Hotel by Westin",
  "Tinte",
  "Comcast",
  "Seattle Center",
  "Ivar's",
  "The Edgewater Hotel",
  "Conviva AI",
  "Seattle Opera",
  "Hilton Embassy Suites",
  "PCL Construction",
  "WA Golf",
  "Residence INN Seattle Downtown/Convention Center",
  "Moxy Hotel",
  "Esterre",
  "Talking Rain",
  "KOMO 4",
  "GIAN Events",
  "The Hall",
  "Space Needle",
  "CORT",
  "YMCA",
  "Vino FC",
  "Simply Seattle",
  "VIA Creatives",
  "MVP Photo Booth",
  "BDA",
  "Concierge Nurse Services",
  "Ignite Designs NW",
  "Marq",
  "J. Fields DJ Entertainment",
  "Sarah's Celebrations",
  "SJ Catering & Events",
  "Kaneri Films",
  "Moment.us",
  "Intrepid",
  "Seattle Top Tix",
  "Going Twice",
  "Trifilm",
  "Feary Group",
  "Encore",
  "Phishgrad",
  "Brooks Running",
  "Madak",
  "Cutter & Buck",
  "Net Tech",
  "Ballard Spahr Lane Powell",
  "Brighton Jones",
  "Level Hotel",
  "The Westin",
  "Mortenson",
  "WaFd",
  "Slalom",
  "Kimley Horn",
  "SOWA",
  "Kraken",
  "Mariners",
  "Orcas",
  "Reign FC",
  "Seahawks",
  "Seawolves",
  "Sounders FC",
  "Storm",
  "Torrent",
  "University of Washington Athletics",
  "WSU Cougars",
  "Seattle University",
];

function main() {
  assert.equal(PAGE_LABELS.length, 110, "page listed 110 tiles");
  assert.equal(SEATTLE_SPORTS_PARTNERS.length, 108, "two tiles are the same organization listed twice");

  const covered = new Set<string>();
  const names = new Set<string>();
  for (const partner of SEATTLE_SPORTS_PARTNERS) {
    const key = normalizeOrgName(partner.name);
    assert.ok(!names.has(key), `duplicate org ${partner.name}`);
    names.add(key);
    assert.ok(partner.websiteUrl.startsWith("http"), `${partner.name} needs a real website`);
    assert.notEqual(partner.websiteUrl, "#");
    assert.ok(partner.tiers.length >= 1, partner.name);
    for (const label of sscPartnerLabels(partner)) covered.add(label.toLowerCase());

    const fit = sscPartnerFit(partner);
    assert.match(fit, /Fan Chant/);
    assert.match(fit, /seattlesports\.org\/partners/);
    assert.match(fit, /beyond the game|past the game|beyond-sports|Rave Choir|later path|in bounds/i);

    const initiative = sscSalesInitiative(partner);
    const sponsor = initiative === "sponsor_partners";
    assert.equal(sponsor, partner.lane !== "team" && partner.lane !== "university");
    assert.equal(
      classifyQueueCategory({
        salesInitiative: initiative,
        organizationName: partner.name,
        organizationTypeKey: partner.organizationTypeKey,
        opportunityTypeKey: sscOpportunityTypeKey(partner),
      }),
      sponsor ? "sponsors" : "sports"
    );
    assert.equal(
      classifyWorkstream({
        salesInitiative: initiative,
        organizationTypeKey: partner.organizationTypeKey,
        category: sponsor ? "sponsors" : "sports",
      }),
      sponsor ? "sponsor" : "partnership"
    );
    assert.match(sscOpportunityTitle(partner), sponsor ? /^Fan Chant sponsor — / : /^Fan Chant — /);
  }

  for (const label of PAGE_LABELS) {
    assert.ok(covered.has(label.toLowerCase()), `missing page partner: ${label}`);
  }

  const ballard = SEATTLE_SPORTS_PARTNERS.find((partner) => partner.name === "Ballard Spahr");
  assert.deepEqual(ballard?.tiers, ["event", "patron"]);
  const playEquity = SEATTLE_SPORTS_PARTNERS.filter((partner) =>
    sscPartnerLabels(partner).some((label) => label.toLowerCase() === "play equity")
  );
  assert.equal(playEquity.length, 1);
  assert.equal(playEquity[0]?.name, "King County Play Equity Coalition");

  assert.equal(SEATTLE_SPORTS_PARTNERS.filter((partner) => partner.lane === "team").length, 9);
  assert.equal(SEATTLE_SPORTS_PARTNERS.filter((partner) => partner.lane === "university").length, 3);
  assert.ok(!covered.has("urban x"));

  const marriott = SEATTLE_SPORTS_PARTNERS.filter(
    (partner) => extractDomain(partner.websiteUrl) === "marriott.com"
  );
  assert.ok(marriott.length >= 3, "hotel properties stay separate even on marriott.com");
  assert.ok(SSC_SHARED_PLATFORM_DOMAINS.has("marriott.com"));
  assert.equal(SSC_PARTNERS_SOURCE_URL, "https://seattlesports.org/partners");

  assert.equal(
    shouldClaimSscPartner({
      exists: false,
      isExistingClient: false,
      doNotProspect: false,
      currentInitiative: null,
      desiredInitiative: "sponsor_partners",
      activeOpportunityCount: 0,
    }),
    true
  );
  assert.equal(
    shouldClaimSscPartner({
      exists: true,
      isExistingClient: false,
      doNotProspect: false,
      currentInitiative: "sports_fan_culture",
      desiredInitiative: "sports_fan_culture",
      activeOpportunityCount: 2,
    }),
    true,
    "an existing team stays in Fan Chant"
  );
  assert.equal(
    shouldClaimSscPartner({
      exists: true,
      isExistingClient: false,
      doNotProspect: false,
      currentInitiative: "tech_conferences",
      desiredInitiative: "sponsor_partners",
      activeOpportunityCount: 1,
    }),
    false,
    "a live conference pursuit is not retagged as a sponsor"
  );
  assert.equal(
    shouldClaimSscPartner({
      exists: true,
      isExistingClient: true,
      doNotProspect: false,
      currentInitiative: null,
      desiredInitiative: "sponsor_partners",
      activeOpportunityCount: 0,
    }),
    false
  );
  assert.equal(isHeldFromAutoPipeline({ holdAutoPipeline: true }), true);
  assert.equal(isHeldFromAutoPipeline({ holdAutoPipeline: false }), false);
  assert.equal(isHeldFromAutoPipeline(null), false);

  console.log("seattle-sports-partners tests passed");
}

main();
