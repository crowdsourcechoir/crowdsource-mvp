/**
 * Hunter Domain Search for Seattle fundraising seed rows.
 * Usage: node scripts/sales/research-seattle-fundraisers.mjs
 * Writes lib/sales/seed/seattle-fundraisers-2027.generated.json then regenerates the TS seed.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const OUT_JSON = join(ROOT, "lib/sales/seed/seattle-fundraisers-2027.contacts.json");
const OUT_TS = join(ROOT, "lib/sales/seed/seattle-fundraisers-2027.ts");

const API_KEY = process.env.HUNTER_API_KEY?.trim();
if (!API_KEY) {
  console.error("MISSING: HUNTER_API_KEY");
  process.exit(1);
}

/** @typedef {{ name: string, event: string, date: string|null, dateStatus: string, location: string, link: string, websiteUrl: string, domain: string, city: string }} RawEvent */

/** @type {RawEvent[]} */
const RAW = [
  { name: "St. Joseph Parish School", event: "Auction", date: "2027-02-06", dateStatus: "Confirmed 2027", location: "Venue TBD; Issaquah/Snoqualmie school", link: "https://resources.finalsite.net/images/v1777914971/sjsissaquahorg/rpes8erbpz1s537bpmet/MasterCalendar2026-2027.pdf", websiteUrl: "https://www.sjsissaquah.org/", domain: "sjsissaquah.org", city: "Issaquah" },
  { name: "Our Lady of Guadalupe School", event: "School Auction", date: "2027-02-27", dateStatus: "Confirmed 2027", location: "Venue TBD; West Seattle", link: "https://www.guadalupe-school.org/school-auction/", websiteUrl: "https://www.guadalupe-school.org/", domain: "guadalupe-school.org", city: "Seattle" },
  { name: "Kindering", event: "Annual Auction Gala", date: "2027-02-27", dateStatus: "Confirmed 2027", location: "Hyatt Regency Bellevue; Bellevue", link: "https://kindering.org/get-involved/events/", websiteUrl: "https://kindering.org/", domain: "kindering.org", city: "Bellevue" },
  { name: "Newcastle Elementary PTSA", event: "All In for the Lions Auction", date: "2027-03-05", dateStatus: "Confirmed 2027", location: "Venue TBD; Newcastle school", link: "https://newcastleptsa.org/Home", websiteUrl: "https://newcastleptsa.org/", domain: "newcastleptsa.org", city: "Newcastle" },
  { name: "Our Lady of Hope School", event: "Spring Gala & Auction", date: "2027-03-06", dateStatus: "Confirmed 2027", location: "Venue TBD; Everett school", link: "https://ladyofhopeschool.org/auction", websiteUrl: "https://ladyofhopeschool.org/", domain: "ladyofhopeschool.org", city: "Everett" },
  { name: "UNCF Seattle", event: "A Mind Is Gala", date: "2027-03-06", dateStatus: "Confirmed 2027", location: "Hyatt Regency Seattle; Seattle", link: "https://uncf.org/events/2027-uncf-a-mind-is-gala-seattle", websiteUrl: "https://uncf.org/", domain: "uncf.org", city: "Seattle" },
  { name: "Melodic Caring Project", event: "Raise a Record Gala", date: "2027-03-06", dateStatus: "Confirmed 2027", location: "Neptune Theatre; Seattle", link: "https://melodiccaring.org/gala/", websiteUrl: "https://melodiccaring.org/", domain: "melodiccaring.org", city: "Seattle" },
  { name: "American Cancer Society", event: "Fork Cancer Seattle", date: "2027-03-11", dateStatus: "Confirmed 2027", location: "Block 41; Seattle", link: "https://forkcancerseattle.acsgala.org/", websiteUrl: "https://www.cancer.org/", domain: "cancer.org", city: "Seattle" },
  { name: "Chief Sealth International High School PTSA", event: "Dinner & Auction / 70th Anniversary", date: "2027-03-13", dateStatus: "Confirmed 2027", location: "Brockey Center, South Seattle College; Seattle", link: "https://www.chiefsealthinternationalhighschoolptsa.org/2027-auction", websiteUrl: "https://www.chiefsealthinternationalhighschoolptsa.org/", domain: "chiefsealthinternationalhighschoolptsa.org", city: "Seattle" },
  { name: "Bishop Blanchet High School", event: "SHINE Gala", date: "2027-03-13", dateStatus: "Confirmed 2027", location: "Venue TBD; Seattle school", link: "https://www.bishopblanchet.org/student-life/neighbors", websiteUrl: "https://www.bishopblanchet.org/", domain: "bishopblanchet.org", city: "Seattle" },
  { name: "Make-A-Wish Alaska & Washington", event: "Wish Night Gala & Auction", date: "2027-03-13", dateStatus: "Confirmed 2027", location: "Sheraton Grand Seattle; Seattle", link: "https://wish.org/akwa/events/wish-night", websiteUrl: "https://wish.org/akwa", domain: "wish.org", city: "Seattle" },
  { name: "BrightSpark", event: "Annual Event", date: "2027-03-18", dateStatus: "Confirmed 2027", location: "Sheraton Grand Seattle; Seattle", link: "https://www.brightspark.org/2027-annual-event/", websiteUrl: "https://www.brightspark.org/", domain: "brightspark.org", city: "Seattle" },
  { name: "Seattle Academy", event: "SAAS in the City", date: "2027-03-20", dateStatus: "Confirmed 2027", location: "Seattle Convention Center Summit; Seattle", link: "https://www.seattleacademy.org/support-saas/saas-in-the-city", websiteUrl: "https://www.seattleacademy.org/", domain: "seattleacademy.org", city: "Seattle" },
  { name: "Bellevue Christian School", event: "Annual Auction", date: "2027-03-20", dateStatus: "Confirmed 2027", location: "Venue TBD; Eastside school", link: "https://www.bellevuechristian.org/calendar/list/page/2/?tribe-bar-date=2026-10-07", websiteUrl: "https://www.bellevuechristian.org/", domain: "bellevuechristian.org", city: "Bellevue" },
  { name: "Hope Lutheran School", event: "Annual Auction", date: "2027-03-20", dateStatus: "Confirmed 2027", location: "Venue TBD; West Seattle school", link: "https://hls.hopeseattle.org/community/pth-auction/", websiteUrl: "https://hls.hopeseattle.org/", domain: "hopeseattle.org", city: "Seattle" },
  { name: "Green Lake Elementary PTA", event: "Auction & Gala", date: "2027-03-20", dateStatus: "Confirmed 2027", location: "Hideaway Cellars; Seattle", link: "https://www.greenlakedragons.org/events/auction", websiteUrl: "https://www.greenlakedragons.org/", domain: "greenlakedragons.org", city: "Seattle" },
  { name: "Assistance League of the Eastside", event: "Through the Looking Glass Gala", date: "2027-03-25", dateStatus: "Published 2027 date; verify with organizer", location: "The Golf Club at Newcastle; Newcastle", link: "https://www.assistanceleague.org/the-eastside/gala-2026/", websiteUrl: "https://www.assistanceleague.org/the-eastside/", domain: "assistanceleague.org", city: "Newcastle" },
  { name: "Bellevue Schools Foundation", event: "Spring for Schools", date: "2027-03-27", dateStatus: "Confirmed 2027", location: "The Westin Bellevue; Bellevue", link: "https://www.bellevueschoolsfoundation.org/sfs27", websiteUrl: "https://www.bellevueschoolsfoundation.org/", domain: "bellevueschoolsfoundation.org", city: "Bellevue" },
  { name: "Holy Rosary School", event: "Annual Auction", date: "2027-03-15", dateStatus: "Month confirmed; exact date TBD", location: "Venue TBD; West Seattle school", link: "https://holyrosaryws.org/giving/auction/", websiteUrl: "https://holyrosaryws.org/", domain: "holyrosaryws.org", city: "Seattle" },
  { name: "Coe Elementary PTA", event: "Live Auction & Dinner", date: "2027-04-02", dateStatus: "Confirmed 2027", location: "Venue TBD; Queen Anne school, Seattle", link: "https://coepta.squarespace.com/events/coe-auction-2027-tickets", websiteUrl: "https://coepta.squarespace.com/", domain: "coepta.squarespace.com", city: "Seattle" },
  { name: "Eastside Catholic School", event: "STARS Gala Auction", date: "2027-04-10", dateStatus: "Confirmed 2027", location: "Hyatt Regency Bellevue; Bellevue", link: "https://www.eastsidecatholic.org/giving/auction", websiteUrl: "https://www.eastsidecatholic.org/", domain: "eastsidecatholic.org", city: "Sammamish" },
  { name: "Holy Family Parish School", event: "Annual Auction", date: "2027-04-10", dateStatus: "Confirmed 2027", location: "Venue TBD; Kirkland school", link: "https://www.hfkschool.org/supporthfk/auction", websiteUrl: "https://www.hfkschool.org/", domain: "hfkschool.org", city: "Kirkland" },
  { name: "St. Pius X School", event: "Gala & Auction", date: "2027-04-10", dateStatus: "Confirmed 2027", location: "St. Pius X School Gymnasium; Mountlake Terrace", link: "https://stpx.org/auction", websiteUrl: "https://stpx.org/", domain: "stpx.org", city: "Mountlake Terrace" },
  { name: "Holy Names Academy", event: "CHEER Dinner & Auction", date: "2027-04-17", dateStatus: "Confirmed 2027", location: "Venue TBD; Seattle school", link: "https://www.holynames-sea.org/giving/events/cheer", websiteUrl: "https://www.holynames-sea.org/", domain: "holynames-sea.org", city: "Seattle" },
  { name: "Our Lady of the Lake School", event: "Annual Auction", date: "2027-04-24", dateStatus: "Confirmed 2027", location: "Venue TBD; Northeast Seattle school", link: "https://www.school.ollseattle.org/give/auction", websiteUrl: "https://www.school.ollseattle.org/", domain: "ollseattle.org", city: "Seattle" },
  { name: "The Goodtimes Project", event: "Goodtimes Gala", date: "2027-04-24", dateStatus: "Confirmed 2027", location: "Bell Harbor International Conference Center; Seattle", link: "https://www.thegoodtimesproject.org/gala", websiteUrl: "https://www.thegoodtimesproject.org/", domain: "thegoodtimesproject.org", city: "Seattle" },
  { name: "Little Bit Therapeutic Riding Center", event: "Reins of Life Gala Auction", date: "2027-04-24", dateStatus: "Confirmed 2027", location: "Venue TBD; Redmond organization", link: "https://www.littlebit.org/events/auction", websiteUrl: "https://www.littlebit.org/", domain: "littlebit.org", city: "Redmond" },
  { name: "Heritage Christian Academy", event: "Heritage Roundup Auction", date: "2027-05-01", dateStatus: "Confirmed 2027", location: "Crossroads at Thomas Family Farm; venue city to verify", link: "https://www.hcabothell.org/auction", websiteUrl: "https://www.hcabothell.org/", domain: "hcabothell.org", city: "Bothell" },
  { name: "St. Anne School", event: "Gala & Live Auction (also Family Night & Silent Auction May 7)", date: "2027-05-15", dateStatus: "Confirmed 2027", location: "Venue TBD; Queen Anne school, Seattle", link: "https://stannesea.org/giving/auction/", websiteUrl: "https://stannesea.org/", domain: "stannesea.org", city: "Seattle" },
  { name: "The 5th Avenue Theatre", event: "Spotlight Soirée Annual Auction & Gala", date: "2027-05-07", dateStatus: "Confirmed 2027", location: "Sheraton Grand Seattle; Seattle", link: "https://www.5thavenue.org/support/special-events/gala/", websiteUrl: "https://www.5thavenue.org/", domain: "5thavenue.org", city: "Seattle" },
  { name: "Alliance for Education", event: "Gala, Auction & After Party", date: "2027-05-08", dateStatus: "Confirmed 2027", location: "Seattle Convention Center Summit; Seattle", link: "https://www.alliance4ed.org/news-events/gala-auction/", websiteUrl: "https://www.alliance4ed.org/", domain: "alliance4ed.org", city: "Seattle" },
  { name: "Lifelong", event: "Pride Gala", date: "2027-06-12", dateStatus: "Confirmed 2027", location: "Venue TBD; Seattle-area event", link: "https://www.pridegala.org/", websiteUrl: "https://www.lifelong.org/", domain: "lifelong.org", city: "Seattle" },
  { name: "The Evergreen School", event: "Spring Benefit", date: null, dateStatus: "Usually March; 2027 date unconfirmed", location: "Venue TBD; Shoreline school", link: "https://www.evergreenschool.org/giving/giving-faq", websiteUrl: "https://www.evergreenschool.org/", domain: "evergreenschool.org", city: "Shoreline" },
  { name: "Communities In Schools of Washington", event: "35th Anniversary Gala", date: null, dateStatus: "Spring 2027 announced; exact date unconfirmed", location: "Venue and city TBD; Washington organization", link: "https://ciswa.org/news/", websiteUrl: "https://ciswa.org/", domain: "ciswa.org", city: "Seattle" },
  { name: "Seattle Waldorf School", event: "Inspire", date: null, dateStatus: "2026 event identified; exact date and 2027 date unconfirmed", location: "Venue TBD; Seattle school", link: "https://seattlewaldorf.org/community/inspire/", websiteUrl: "https://seattlewaldorf.org/", domain: "seattlewaldorf.org", city: "Seattle" },
  { name: "Roosevelt Jazz", event: "Gala & Auction", date: "2026-03-06", dateStatus: "Historical 2026; verify 2027", location: "UW Botanic Gardens; Seattle", link: "https://www.rooseveltjazz.org/events/auction/", websiteUrl: "https://www.rooseveltjazz.org/", domain: "rooseveltjazz.org", city: "Seattle" },
  { name: "Seattle Adaptive Sports", event: "Oceans of Opportunity Gala", date: "2026-03-07", dateStatus: "Historical 2026; verify 2027", location: "Sunset Bay Lodge at Ballard Elks; Seattle", link: "https://seattleadaptivesports.ejoinme.org/MyEvents/OceansofOpportunity2026/tabid/1574866/Default.aspx", websiteUrl: "https://seattleadaptivesports.org/", domain: "seattleadaptivesports.org", city: "Seattle" },
  { name: "The Bush School", event: "Celebrate Bush", date: "2026-03-14", dateStatus: "Historical 2026; verify 2027", location: "Venue TBD; Seattle school", link: "https://www.bush.edu/announcement-detail?fromId=312486&pk=1499159", websiteUrl: "https://www.bush.edu/", domain: "bush.edu", city: "Seattle" },
  { name: "New Horizon School", event: "A Starry Night Gala & Auction", date: "2026-03-14", dateStatus: "Historical 2026; verify 2027", location: "Renaissance Seattle Hotel; Seattle", link: "https://www.new-horizon-school.org/2026gala/", websiteUrl: "https://www.new-horizon-school.org/", domain: "new-horizon-school.org", city: "Renton" },
  { name: "Amrita-Seattle", event: "Annual Gala", date: "2026-03-14", dateStatus: "Historical 2026; verify 2027", location: "Meydenbauer Center; Bellevue", link: "https://www.amrita-seattle.org/galaseattle2026", websiteUrl: "https://www.amrita-seattle.org/", domain: "amrita-seattle.org", city: "Bellevue" },
  { name: "American Parkinson Disease Association Northwest", event: "Magic of Hope Gala & Auction", date: "2026-03-14", dateStatus: "Historical 2026; verify 2027", location: "Sheraton Grand Seattle; Seattle", link: "https://apdawasc.ejoinme.org/MyEvents/2026MagicofHopeGalaAuction/tabid/1564567/Default.aspx", websiteUrl: "https://www.apdaparkinson.org/community/northwest/", domain: "apdaparkinson.org", city: "Seattle" },
  { name: "Harvest Against Hunger", event: "Hearts & Wine", date: "2026-03-20", dateStatus: "Historical 2026; verify 2027", location: "Victory Hall at the Boxyard; Seattle", link: "https://district5030.org/hearts-wine-a-harvest-against-hunger-tradition/", websiteUrl: "https://www.harvestagainsthunger.org/", domain: "harvestagainsthunger.org", city: "Seattle" },
  { name: "Hazel Wolf K–8 PTA", event: "Spring Auction", date: "2026-03-21", dateStatus: "Historical 2026; verify 2027", location: "Magnuson Park Hangar 30; Seattle", link: "https://hazelwolfk8.seattleschools.org/news/01-04-26-family-bulletin/", websiteUrl: "https://hazelwolfk8.seattleschools.org/", domain: "seattleschools.org", city: "Seattle" },
  { name: "Seattle Arts & Lectures", event: "Words Bloom Benefit Dinner & Literary Auction", date: "2026-03-21", dateStatus: "Historical 2026; verify 2027", location: "Seattle Convention Center Summit; Seattle", link: "https://lectures.org/event/words-bloom-2026/", websiteUrl: "https://lectures.org/", domain: "lectures.org", city: "Seattle" },
  { name: "Nick of Time Foundation", event: "20th Anniversary Gala", date: "2026-03-21", dateStatus: "Historical 2026; verify 2027", location: "Fairmont Olympic Hotel; Seattle", link: "https://nickoftimefoundation.org/wp-content/uploads/2026-Sponsor-Levels.pdf", websiteUrl: "https://nickoftimefoundation.org/", domain: "nickoftimefoundation.org", city: "Seattle" },
  { name: "Lake Washington Schools Foundation", event: "Be the Bridge", date: "2026-03-26", dateStatus: "Historical 2026; verify 2027", location: "Venue TBD; Eastside organization", link: "https://www.lwsf.org/lp/table-captain/", websiteUrl: "https://www.lwsf.org/", domain: "lwsf.org", city: "Redmond" },
  { name: "St. John School", event: "Annual Auction", date: "2026-03-27", dateStatus: "Historical 2026; verify 2027", location: "Fremont Studios; Seattle", link: "https://sjess.ejoinme.org/2026auction", websiteUrl: "https://www.st-johnschool.org/", domain: "st-johnschool.org", city: "Seattle" },
  { name: "Loyal Heights Elementary PTA", event: "Annual Auction", date: "2026-03-28", dateStatus: "Historical 2026; verify 2027", location: "Ballard Elks; Seattle", link: "https://loyalheightses.seattleschools.org/events/loyal-heights-pta-auction/", websiteUrl: "https://loyalheightses.seattleschools.org/", domain: "seattleschools.org", city: "Seattle" },
  { name: "Seattle JazzED", event: "Soundtrack for the Future Gala", date: "2026-04-23", dateStatus: "Historical 2026; verify 2027", location: "The Triple Door; Seattle", link: "https://www.seattlejazzed.org/blog/2026/5/5/soundtrack-for-the-future-gala-recap", websiteUrl: "https://www.seattlejazzed.org/", domain: "seattlejazzed.org", city: "Seattle" },
  { name: "French American School of Puget Sound", event: "Gala & Auction", date: "2026-04-25", dateStatus: "Historical 2026; verify 2027", location: "Fairmont Olympic Hotel; Seattle", link: "https://www.fasps.org/gala-auction", websiteUrl: "https://www.fasps.org/", domain: "fasps.org", city: "Mercer Island" },
  { name: "St. Madeleine Sophie School", event: "Celebrate St. Madeleine’s Gala", date: "2026-04-25", dateStatus: "Historical 2026; verify 2027", location: "Seattle Marriott Bellevue; Bellevue", link: "https://smsbellevue.org/celebrate-st-madeleines-gala/", websiteUrl: "https://smsbellevue.org/", domain: "smsbellevue.org", city: "Bellevue" },
  { name: "St. Francis of Assisi School", event: "Auction & Gala", date: "2026-04-25", dateStatus: "Historical 2026; verify 2027", location: "Venue TBD; Burien school", link: "https://stfrancisofassisisea.ejoinme.org/2026Auction", websiteUrl: "https://www.stfrancisburien.org/", domain: "stfrancisburien.org", city: "Burien" },
  { name: "Northwest Children’s Foundation", event: "UNITE Gala & Auction", date: "2026-05-02", dateStatus: "Historical 2026; verify 2027", location: "Venue TBD; Seattle-area organization", link: "https://nwcf.org/wp-content/uploads/2026/01/2026-UNITE-NWCF-Gala-Sponsorship-Opportunities.pdf", websiteUrl: "https://nwcf.org/", domain: "nwcf.org", city: "Seattle" },
  { name: "Seattle Humane", event: "Tuxes & Tails", date: "2026-05-16", dateStatus: "Historical 2026; verify 2027", location: "Venue TBD; Seattle-area event", link: "https://www.seattlehumane.org/wp-content/uploads/2025/12/15-SEAWA-0925-N-1-1.pdf", websiteUrl: "https://www.seattlehumane.org/", domain: "seattlehumane.org", city: "Bellevue" },
  { name: "St. Luke School", event: "Annual Auction", date: "2026-11-14", dateStatus: "Confirmed 2026; outside spring", location: "Venue TBD; Shoreline school", link: "https://www.stlukeshoreline.org/giving/auction", websiteUrl: "https://www.stlukeshoreline.org/", domain: "stlukeshoreline.org", city: "Shoreline" },
];

const SENIORITY_RANK = {
  executive: 100,
  "c-suite": 100,
  founder: 95,
  owner: 95,
  partner: 90,
  vp: 85,
  director: 70,
  head: 65,
  senior: 50,
  manager: 40,
  lead: 35,
  mid: 20,
  junior: 10,
  entry: 5,
};

function titleBonus(position) {
  if (!position) return 0;
  const p = position.toLowerCase();
  let bonus = 0;
  if (/\b(chief|ceo|coo|cfo|cmo|cto|president|executive director|ed)\b/.test(p)) bonus += 40;
  if (/\b(vp|vice\s*president)\b/.test(p)) bonus += 30;
  if (/\b(director|head\s+of)\b/.test(p)) bonus += 20;
  if (/\b(development|advancement|fundraising|philanthropy|auction|gala|events?)\b/.test(p)) bonus += 25;
  if (/\b(senior)\b/.test(p)) bonus += 8;
  if (/\b(manager)\b/.test(p)) bonus += 5;
  if (/\b(specialist|coordinator|assistant|associate|teacher|coach)\b/.test(p)) bonus -= 10;
  return bonus;
}

function rank(person) {
  const seniorityScore = SENIORITY_RANK[(person.seniority ?? "").toLowerCase()] ?? 0;
  const confidence = typeof person.confidence === "number" ? person.confidence : 0;
  return seniorityScore + titleBonus(person.position) + confidence / 100;
}

function mapPerson(raw) {
  const email = typeof raw.value === "string" ? raw.value.trim().toLowerCase() : "";
  if (!email) return null;
  const firstName = typeof raw.first_name === "string" ? raw.first_name.trim() : "";
  const lastName = typeof raw.last_name === "string" ? raw.last_name.trim() : "";
  const verification =
    raw.verification && typeof raw.verification === "object" ? raw.verification.status : null;
  return {
    email,
    firstName: firstName || null,
    lastName: lastName || null,
    position: typeof raw.position === "string" ? raw.position.trim() || null : null,
    seniority: typeof raw.seniority === "string" ? raw.seniority : null,
    department: typeof raw.department === "string" ? raw.department : null,
    type: typeof raw.type === "string" ? raw.type : null,
    confidence: typeof raw.confidence === "number" ? raw.confidence : null,
    verificationStatus: typeof verification === "string" ? verification : null,
  };
}

async function hunterAccount() {
  const res = await fetch(`https://api.hunter.io/v2/account?api_key=${API_KEY}`);
  const data = await res.json();
  return data?.data?.requests?.credits ?? null;
}

async function domainSearch(domain, { jobTitles, departments, limit = 10 } = {}) {
  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("domain", domain);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("type", "personal");
  url.searchParams.set("required_field", "full_name");
  if (jobTitles?.length) url.searchParams.set("job_titles", jobTitles.join(","));
  if (departments?.length) url.searchParams.set("department", departments.join(","));
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, people: [], error: data?.errors?.[0]?.details || `HTTP ${res.status}` };
  }
  const emails = Array.isArray(data?.data?.emails) ? data.data.emails : [];
  return { ok: true, people: emails.map(mapPerson).filter(Boolean), error: null };
}

function confidenceToStatus(v) {
  if (v === "valid") return "verified_deliverable";
  if (v === "invalid") return "invalid";
  if (v === "accept_all" || v === "webmail" || v === "risky") return "risky";
  return "valid_format";
}

function roleCategory(position) {
  const p = (position ?? "").toLowerCase();
  if (/\b(event|auction|gala|program)\b/.test(p)) return "events";
  if (/\b(development|advancement|fundraising|philanthropy|donor)\b/.test(p)) return "development";
  if (/\b(market|communicat|pr)\b/.test(p)) return "marketing";
  if (/\b(executive|director|president|principal|ceo|coo|head)\b/.test(p)) return "executive";
  return "other";
}

function dateConfidence(status, date) {
  if (!date) return "unknown";
  if (/^Confirmed/i.test(status) && !/exact date TBD|outside spring/i.test(status)) return "confirmed";
  if (/Month confirmed|Published 2027|Historical|unconfirmed|verify/i.test(status)) return "estimated";
  return "estimated";
}

function formatDateLabel(date, event) {
  if (!date) return event;
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return `${event} (${date})`;
  const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${event} — ${label}`;
}

async function researchDomain(domain) {
  // Prefer development / events titles first; fall back to management.
  let result = await domainSearch(domain, {
    jobTitles: [
      "director of development",
      "director of advancement",
      "development director",
      "events director",
      "auction chair",
      "gala",
      "fundraising",
      "executive director",
      "head of school",
      "principal",
    ],
    limit: 10,
  });
  if (!result.ok || result.people.length < 2) {
    const fallback = await domainSearch(domain, {
      departments: ["management", "communication"],
      limit: 10,
    });
    if (fallback.ok) {
      const byEmail = new Map();
      for (const p of [...result.people, ...fallback.people]) byEmail.set(p.email, p);
      result = { ok: true, people: [...byEmail.values()], error: null };
    }
  }
  const named = result.people.filter((p) => p.firstName && p.lastName && p.type !== "generic");
  const top = [...named].sort((a, b) => rank(b) - rank(a)).slice(0, 3);
  return { people: top, error: result.error, hunterReturned: named.length };
}

function esc(s) {
  return JSON.stringify(s);
}

function emitTs(seeds) {
  const lines = [];
  lines.push(`import type { SeedOrgWithContactsInput } from "@/lib/sales/seed/seed-org-with-contacts";`);
  lines.push("");
  lines.push(`/**`);
  lines.push(` * Seattle-area school/nonprofit auction & gala shortlist (Joel paste, 2026-10-14).`);
  lines.push(` * Contacts from Hunter Domain Search (top 3 development/events/executive).`);
  lines.push(` * St. Anne School Family Night + Gala merged into one org (primary: May 15 Gala).`);
  lines.push(` */`);
  lines.push(`export const SEATTLE_FUNDRAISERS_2027_SEEDS: SeedOrgWithContactsInput[] = [`);
  for (const seed of seeds) {
    lines.push(`  {`);
    lines.push(`    name: ${esc(seed.name)},`);
    lines.push(`    websiteUrl: ${esc(seed.websiteUrl)},`);
    lines.push(`    locationCity: ${esc(seed.locationCity)},`);
    lines.push(`    locationRegion: "WA",`);
    lines.push(`    locationCountry: "US",`);
    lines.push(`    organizationTypeKey: "nonprofit",`);
    lines.push(`    salesInitiative: "fundraising_galas",`);
    lines.push(`    opportunityTypeKey: "fundraising_gala",`);
    lines.push(`    forceManualQueue: true,`);
    lines.push(`    runPipeline: false,`);
    lines.push(`    manualEventName: ${esc(seed.manualEventName)},`);
    lines.push(`    manualQueueTitle: ${esc(seed.manualQueueTitle)},`);
    lines.push(`    manualQueueDescription: ${esc(seed.manualQueueDescription)},`);
    if (seed.eventDateEstimate) {
      lines.push(`    eventDateEstimate: ${esc(seed.eventDateEstimate)},`);
    } else {
      lines.push(`    eventDateEstimate: null,`);
    }
    lines.push(`    eventDateConfidence: ${esc(seed.eventDateConfidence)},`);
    lines.push(`    contacts: [`);
    for (const c of seed.contacts) {
      lines.push(`      {`);
      lines.push(`        fullName: ${esc(c.fullName)},`);
      lines.push(`        email: ${esc(c.email)},`);
      lines.push(`        roleTitle: ${esc(c.roleTitle)},`);
      lines.push(`        roleCategory: ${esc(c.roleCategory)},`);
      if (c.emailVerificationStatus) {
        lines.push(`        emailVerificationStatus: ${esc(c.emailVerificationStatus)},`);
      }
      lines.push(`        roleDescription: ${esc(c.roleDescription)},`);
      lines.push(`      },`);
    }
    lines.push(`    ],`);
    lines.push(`  },`);
  }
  lines.push(`];`);
  lines.push("");
  return lines.join("\n");
}

function isWeakTitle(position) {
  const p = (position ?? "").toLowerCase();
  return /\b(library|teacher|coach|counselor|nurse|custodian|aide|assistant teacher|media specialist)\b/.test(p);
}

function contactsFromPeople(people, orgName, event) {
  const strong = people.filter((p) => !isWeakTitle(p.position));
  const picked = (strong.length > 0 ? strong : people).slice(0, 3);
  return picked.map((p) => ({
    fullName: `${p.firstName} ${p.lastName}`.trim(),
    email: p.email,
    roleTitle: p.position || "Staff",
    roleCategory: roleCategory(p.position),
    emailVerificationStatus: confidenceToStatus(p.verificationStatus),
    roleDescription: `${p.position || "Contact"} at ${orgName} — doorway for ${event}.`,
  }));
}

function buildSeeds(byDomain) {
  return RAW.map((row) => {
    const found = byDomain[row.domain]?.people ?? [];
    let contacts = contactsFromPeople(found, row.name, row.event);

    if (contacts.length === 0) {
      contacts = [
        {
          fullName: `${row.name} Office`,
          email: `info@${row.domain}`,
          roleTitle: "General inbox",
          roleCategory: "other",
          emailVerificationStatus: "valid_format",
          roleDescription: `Fallback inbox — Hunter had no named contacts on ${row.domain}; find development/events staff after enqueue.`,
        },
      ];
    }

    const conf = dateConfidence(row.dateStatus, row.date);
    const dateLabel = formatDateLabel(row.date, row.event);
    return {
      name: row.name,
      websiteUrl: row.websiteUrl,
      locationCity: row.city,
      manualEventName: row.event,
      manualQueueTitle: `${row.name} — ${dateLabel} participatory anthem`,
      manualQueueDescription: `${row.event} (${row.dateStatus}). ${row.location}. Source: ${row.link}`,
      eventDateEstimate: row.date,
      eventDateConfidence: conf,
      contacts: contacts.slice(0, 3),
      _domain: row.domain,
      _hunterCount: found.length,
    };
  });
}

async function main() {
  const fromCache = process.argv.includes("--from-cache") && existsSync(OUT_JSON);

  /** @type {Record<string, { people: any[], error: string|null, hunterReturned: number }>} */
  let byDomain = {};
  let before = null;
  let after = null;

  if (fromCache) {
    const cached = JSON.parse(readFileSync(OUT_JSON, "utf8"));
    byDomain = cached.byDomain ?? {};
    before = cached.creditsBefore ?? null;
    after = cached.creditsAfter ?? null;
    console.log(`Re-emitting from cache (${Object.keys(byDomain).length} domains)`);
  } else {
    before = await hunterAccount();
    console.log(`Hunter credits before: ${before?.remaining ?? "?"}`);

    const uniqueDomains = [...new Set(RAW.map((r) => r.domain))];
    for (const domain of uniqueDomains) {
      if (domain === "seattleschools.org" || domain === "coepta.squarespace.com") {
        byDomain[domain] = { people: [], error: "shared/hosting domain — skip Hunter", hunterReturned: 0 };
        continue;
      }
      process.stdout.write(`Hunter ${domain}… `);
      try {
        const result = await researchDomain(domain);
        byDomain[domain] = result;
        console.log(`${result.people.length} contacts (${result.hunterReturned} named)`);
      } catch (err) {
        byDomain[domain] = { people: [], error: err instanceof Error ? err.message : String(err), hunterReturned: 0 };
        console.log(`error: ${byDomain[domain].error}`);
      }
      await new Promise((r) => setTimeout(r, 350));
    }

    after = await hunterAccount();
    console.log(`Hunter credits after: ${after?.remaining ?? "?"}`);
    console.log(
      `Credits used: ${
        before && after
          ? before.used != null && after.used != null
            ? after.used - before.used
            : before.remaining - after.remaining
          : "?"
      }`
    );

    writeFileSync(
      OUT_JSON,
      JSON.stringify({ researchedAt: new Date().toISOString(), creditsBefore: before, creditsAfter: after, byDomain }, null, 2)
    );
  }

  const seeds = buildSeeds(byDomain);
  writeFileSync(OUT_TS, emitTs(seeds));
  const with3 = seeds.filter((s) => s.contacts.length >= 3 && !s.contacts[0].roleTitle.includes("inbox")).length;
  const withNamed = seeds.filter((s) => s._hunterCount > 0).length;
  const inboxOnly = seeds.filter((s) => s.contacts.some((c) => c.roleTitle === "General inbox")).length;
  console.log(`Wrote ${OUT_TS}`);
  console.log(`Orgs: ${seeds.length}; with Hunter-named contacts: ${withNamed}; with 3 named: ${with3}; inbox fallback: ${inboxOnly}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
