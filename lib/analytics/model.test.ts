import assert from "node:assert/strict";
import { decideAccess } from "../operators/access";
import type { Actor } from "../operators/types";
import { aggregateVisits, buildVisit, classifyVisit, isBotUserAgent, measurementIdFrom, mergeVisit, redactPath, type VisitEvent } from "./model";

const now = Date.parse("2026-10-01T20:00:00.000Z");

function visit(patch: Partial<VisitEvent> & Pick<VisitEvent, "id" | "path" | "segment" | "entity">): VisitEvent {
  return {
    t: now - 60_000,
    vid: "visitor-1",
    sid: "session-1",
    host: "app.crowdsourcechoir.com",
    ref: "",
    country: "US",
    region: "CA",
    city: "Los Angeles",
    device: "desktop",
    ms: 12_000,
    internal: false,
    ...patch,
  };
}

const checks: Array<[string, boolean]> = [
  ["sobeca path", classifyVisit("/sobeca-song-garden", "app.crowdsourcechoir.com").segment === "sobeca"],
  ["song garden art host", classifyVisit("/", "songgarden.art").segment === "sobeca"],
  ["bloom slug", classifyVisit("/e/csc-oct2/interview", "app.crowdsourcechoir.com").entity === "csc-oct2" && classifyVisit("/e/csc-oct2", "app.crowdsourcechoir.com").segment === "bloom"],
  ["song garden under bloom", classifyVisit("/e/csc-oct2/songgarden", "app.crowdsourcechoir.com").segment === "song-garden"],
  ["garden", classifyVisit("/g/west-edge", "app.crowdsourcechoir.com").segment === "garden"],
  ["live", classifyVisit("/live/night", "app.crowdsourcechoir.com").segment === "live"],
  ["token redacted", redactPath("/p/secret-token") === "/p/:token"],
  ["bot skipped", isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")],
  ["person kept", !isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")],
  ["ga id", measurementIdFrom(" g-abc123 ") === "G-ABC123" && measurementIdFrom("UA-1") === null],
];

const built = buildVisit({
  id: "view-1234",
  path: "/sobeca-song-garden?x=1",
  host: "songgarden.art",
  referrer: "https://instagram.com/p/1",
  ms: 4000,
  vid: "visitor-9",
  sid: "session-9",
  country: "us",
  region: "CA",
  city: "Los Angeles",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
  internal: false,
  now,
});

assert(built?.segment === "sobeca", "build classifies sobeca");
assert(built?.device === "mobile", "build reads the phone");
assert(built?.ref === "instagram.com", "build keeps the referring site");
assert(built?.country === "US", "build stores the country code");
assert(built?.path === "/sobeca-song-garden", "build drops the query string");

const merged = mergeVisit(
  [visit({ id: "view-1", path: "/sobeca-song-garden", segment: "sobeca", entity: "sobeca-song-garden", ms: 1000 })],
  visit({ id: "view-1", path: "/sobeca-song-garden", segment: "sobeca", entity: "sobeca-song-garden", ms: 9000 })
);
assert(merged.length === 1 && merged[0].ms === 9000, "a longer stay replaces the short one");

const report = aggregateVisits(
  [
    visit({ id: "a", path: "/sobeca-song-garden", segment: "sobeca", entity: "sobeca-song-garden", vid: "v1", sid: "s1", country: "US", city: "Los Angeles", ms: 20_000 }),
    visit({ id: "b", path: "/e/csc-oct2", segment: "bloom", entity: "csc-oct2", vid: "v2", sid: "s2", country: "GB", region: "ENG", city: "London", ms: 3000, device: "mobile" }),
    visit({ id: "c", path: "/admin/settings", segment: "admin", entity: "admin", vid: "v1", sid: "s3", internal: true, ms: 50_000 }),
  ],
  { days: 7, includeInternal: false, now }
);

assert(report.daily.length === 7, "the day chart has one bar per day");
assert(report.totals.engagedRate === 50, "a 20 second stay counts as engaged");
assert(report.totals.visitors === 2, "signed-in admin visits stay out of the public count");
assert(report.totals.pageViews === 2, "public page views");
assert(report.countries[0]?.name === "United States", "country name");
assert(report.cities.some((city) => city.label.includes("London")), "city list");
assert(report.segments.some((item) => item.id === "sobeca" && item.views === 1), "sobeca segment");
assert(report.entities.some((item) => item.segment === "bloom" && item.entity === "csc-oct2"), "bloom entity");

const sobeca = aggregateVisits(
  [
    visit({ id: "a", path: "/sobeca-song-garden", segment: "sobeca", entity: "sobeca-song-garden" }),
    visit({ id: "b", path: "/e/csc-oct2", segment: "bloom", entity: "csc-oct2", vid: "v2", sid: "s2" }),
  ],
  { days: 7, includeInternal: false, segment: "sobeca", now }
);
assert(sobeca.totals.pageViews === 1 && sobeca.segments.length === 2, "segment filter narrows totals and keeps the segment list");

for (const [name, ok] of checks) assert(ok, name);

const owner = { role: "owner" } as Actor;
const open = (path: string, method: string, actor: Actor | null) => decideAccess(path, method, new URLSearchParams(), actor).kind;
assert(open("/api/analytics/collect", "POST", null) === "public", "visitors can record a page");
assert(open("/api/analytics/config", "GET", null) === "public", "the measurement id can load");
assert(open("/api/analytics/report", "GET", null) === "deny", "reports stay signed in");
assert(open("/api/analytics/report", "GET", owner) === "allow", "the owner can read reports");
assert(open("/api/analytics/config", "PATCH", null) === "deny", "saving Google Analytics stays signed in");

console.log("analytics checks passed");
