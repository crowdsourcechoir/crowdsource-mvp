export const SEGMENTS = [
  { id: "sobeca", label: "SoBECA" },
  { id: "song-garden", label: "Song Garden" },
  { id: "bloom", label: "Bloom" },
  { id: "garden", label: "Garden" },
  { id: "live", label: "Live" },
  { id: "home", label: "Home" },
  { id: "admin", label: "Admin" },
  { id: "other", label: "Other" },
] as const;

export type SegmentId = (typeof SEGMENTS)[number]["id"];
export type DeviceKind = "mobile" | "tablet" | "desktop";

export type VisitEvent = {
  id: string;
  t: number;
  vid: string;
  sid: string;
  path: string;
  host: string;
  segment: SegmentId;
  entity: string;
  ref: string;
  country: string;
  region: string;
  city: string;
  device: DeviceKind;
  ms: number;
  internal: boolean;
};

export type AnalyticsReport = {
  days: number;
  includeInternal: boolean;
  segment: SegmentId | null;
  from: string;
  to: string;
  totals: {
    visitors: number;
    sessions: number;
    pageViews: number;
    avgEngagementSec: number;
    engagedRate: number;
  };
  daily: { date: string; views: number; visitors: number }[];
  countries: { code: string; name: string; visitors: number; views: number }[];
  cities: { label: string; visitors: number; views: number }[];
  segments: { id: SegmentId; label: string; visitors: number; views: number; avgEngagementSec: number }[];
  entities: { segment: SegmentId; segmentLabel: string; entity: string; visitors: number; views: number; avgEngagementSec: number }[];
  pages: { path: string; visitors: number; views: number; avgEngagementSec: number }[];
  referrers: { host: string; views: number }[];
  devices: { device: string; visitors: number }[];
  hosts: { host: string; views: number; visitors: number }[];
};

const MAX_MS = 30 * 60 * 1000;
const ENGAGED_MS = 10_000;
const ID_RE = /^[A-Za-z0-9-]{8,80}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function measurementIdFrom(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toUpperCase();
  return /^G-[A-Z0-9]{4,20}$/.test(value) ? value : null;
}

export function isBotUserAgent(ua: string): boolean {
  return /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|slackbot|embedly|quora|pinterest|headless|lighthouse|pagespeed|vercel-screenshot/i.test(
    ua
  );
}

export function deviceFromUserAgent(ua: string): DeviceKind {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  return "desktop";
}

export function redactPath(pathname: string): string {
  const bare = (pathname.split("?")[0].split("#")[0] || "/").slice(0, 180);
  if (bare.startsWith("/p/")) return "/p/:token";
  if (bare.startsWith("/invite")) return "/invite";
  if (bare.startsWith("/reset-password")) return "/reset-password";
  if (bare.startsWith("/reset-root-password")) return "/reset-root-password";
  return bare.startsWith("/") ? bare : `/${bare}`;
}

function decodePart(value: string): string {
  try {
    return decodeURIComponent(value).slice(0, 80);
  } catch {
    return value.slice(0, 80);
  }
}

export function classifyVisit(pathname: string, host: string): { segment: SegmentId; entity: string; path: string } {
  const path = redactPath(pathname);
  const hostname = host.split(":")[0].toLowerCase();
  const onSongGardenArt = hostname === "songgarden.art" || hostname.endsWith(".songgarden.art");

  if (
    path === "/sobeca-song-garden" ||
    path.startsWith("/sobeca-song-garden/") ||
    (onSongGardenArt && path === "/")
  ) {
    return { segment: "sobeca", entity: "sobeca-song-garden", path: path === "/" ? "/sobeca-song-garden" : path };
  }

  const bloom = path.match(/^\/e\/([^/]+)(\/.*)?$/);
  if (bloom) {
    const slug = decodePart(bloom[1]);
    if (bloom[2]?.startsWith("/songgarden")) return { segment: "song-garden", entity: slug, path };
    return { segment: "bloom", entity: slug, path };
  }

  const garden = path.match(/^\/g\/([^/]+)/);
  if (garden) return { segment: "garden", entity: decodePart(garden[1]), path };

  const live = path.match(/^\/live\/([^/]+)/);
  if (live) return { segment: "live", entity: decodePart(live[1]), path };

  const adminSong = path.match(/^\/admin\/songgarden\/([^/]+)/);
  if (adminSong) return { segment: "song-garden", entity: decodePart(adminSong[1]), path };

  const adminBloom = path.match(/^\/admin\/(?:events|conductor)\/([^/]+)/);
  if (adminBloom && adminBloom[1] !== "new") return { segment: "bloom", entity: decodePart(adminBloom[1]), path };

  const adminGarden = path.match(/^\/admin\/gardens\/([^/]+)/);
  if (adminGarden && adminGarden[1] !== "new") return { segment: "garden", entity: decodePart(adminGarden[1]), path };

  if (path.startsWith("/admin/settings/song-garden-pitch")) {
    return { segment: "sobeca", entity: "sobeca-song-garden", path };
  }
  if (path.startsWith("/admin")) return { segment: "admin", entity: "admin", path };
  if (path === "/") return { segment: "home", entity: "home", path };
  return { segment: "other", entity: path, path };
}

export function referrerHost(raw: string, selfHost: string): string {
  if (!raw) return "";
  try {
    const host = new URL(raw).host.split(":")[0].toLowerCase();
    const own = selfHost.split(":")[0].toLowerCase();
    if (!host || host === own) return "";
    return host.slice(0, 120);
  } catch {
    return "";
  }
}

export function countryName(code: string): string {
  if (!code || code === "ZZ") return "Unknown";
  try {
    return regionNames.of(code) || code;
  } catch {
    return code;
  }
}

export function segmentLabel(id: SegmentId): string {
  return SEGMENTS.find((item) => item.id === id)?.label ?? id;
}

export function buildVisit(input: {
  id: unknown;
  path: unknown;
  host: string;
  referrer: unknown;
  ms: unknown;
  vid: string;
  sid: string;
  country: string;
  region: string;
  city: string;
  userAgent: string;
  internal: boolean;
  now: number;
}): VisitEvent | null {
  if (typeof input.id !== "string" || !ID_RE.test(input.id)) return null;
  if (typeof input.path !== "string" || !input.path.startsWith("/")) return null;
  const classified = classifyVisit(input.path, input.host);
  if (classified.path.startsWith("/api") || classified.path.startsWith("/_next")) return null;
  const ms = typeof input.ms === "number" && Number.isFinite(input.ms) ? Math.max(0, Math.min(MAX_MS, Math.round(input.ms))) : 0;
  const country = /^[A-Za-z]{2}$/.test(input.country) ? input.country.toUpperCase() : "ZZ";
  return {
    id: input.id,
    t: input.now,
    vid: input.vid,
    sid: input.sid,
    path: classified.path,
    host: input.host.split(":")[0].toLowerCase().slice(0, 120),
    segment: classified.segment,
    entity: classified.entity,
    ref: referrerHost(typeof input.referrer === "string" ? input.referrer : "", input.host),
    country,
    region: input.region.slice(0, 40),
    city: input.city.slice(0, 80),
    device: deviceFromUserAgent(input.userAgent),
    ms,
    internal: input.internal || classified.path.startsWith("/admin"),
  };
}

export function mergeVisit(events: VisitEvent[], event: VisitEvent): VisitEvent[] {
  const index = events.findIndex((item) => item.id === event.id);
  if (index === -1) return [...events, event].slice(-8000);
  const copy = events.slice();
  const current = events[index];
  copy[index] = { ...current, ms: Math.max(current.ms, event.ms), t: current.t };
  return copy;
}

export function isVisitEvent(value: unknown): value is VisitEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<VisitEvent>;
  return typeof event.id === "string" && typeof event.t === "number" && typeof event.path === "string" && typeof event.vid === "string";
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function rangeStart(days: number, now = Date.now()): number {
  const endDay = Date.parse(`${dayKey(now)}T00:00:00.000Z`);
  return endDay - (days - 1) * DAY_MS;
}

function averageSeconds(events: VisitEvent[]): number {
  const timed = events.filter((event) => event.ms > 0);
  if (timed.length === 0) return 0;
  const total = timed.reduce((sum, event) => sum + event.ms, 0);
  return Math.round(total / timed.length / 1000);
}

function topCounts<T extends string>(items: T[], limit: number): { key: T; count: number }[] {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

export function aggregateVisits(
  events: VisitEvent[],
  options: { days: number; includeInternal: boolean; segment?: SegmentId | null; now?: number }
): AnalyticsReport {
  const days = options.days;
  const now = options.now ?? Date.now();
  const start = rangeStart(days, now);
  const windowEvents = events.filter(
    (event) => event.t >= start && event.t <= now && (options.includeInternal || !event.internal)
  );
  const segment = options.segment ?? null;
  const scoped = segment ? windowEvents.filter((event) => event.segment === segment) : windowEvents;

  const visitors = new Set(scoped.map((event) => event.vid));
  const sessions = new Map<string, VisitEvent[]>();
  for (const event of scoped) {
    const list = sessions.get(event.sid) ?? [];
    list.push(event);
    sessions.set(event.sid, list);
  }
  let engaged = 0;
  for (const list of Array.from(sessions.values())) {
    const time = list.reduce((sum, event) => sum + event.ms, 0);
    if (list.length >= 2 || time >= ENGAGED_MS) engaged += 1;
  }

  const daily: AnalyticsReport["daily"] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = dayKey(now - offset * DAY_MS);
    const onDay = scoped.filter((event) => dayKey(event.t) === date);
    daily.push({ date, views: onDay.length, visitors: new Set(onDay.map((event) => event.vid)).size });
  }

  const countryGroups = new Map<string, VisitEvent[]>();
  for (const event of scoped) {
    const list = countryGroups.get(event.country) ?? [];
    list.push(event);
    countryGroups.set(event.country, list);
  }
  const countries = Array.from(countryGroups.entries())
    .map(([code, list]) => ({
      code,
      name: countryName(code),
      visitors: new Set(list.map((event) => event.vid)).size,
      views: list.length,
    }))
    .sort((a, b) => b.visitors - a.visitors || b.views - a.views)
    .slice(0, 12);

  const cityGroups = new Map<string, VisitEvent[]>();
  for (const event of scoped) {
    if (!event.city) continue;
    const label = [event.city, event.region, countryName(event.country)].filter(Boolean).join(", ");
    const list = cityGroups.get(label) ?? [];
    list.push(event);
    cityGroups.set(label, list);
  }
  const cities = Array.from(cityGroups.entries())
    .map(([label, list]) => ({
      label,
      visitors: new Set(list.map((event) => event.vid)).size,
      views: list.length,
    }))
    .sort((a, b) => b.visitors - a.visitors || b.views - a.views)
    .slice(0, 12);

  const segments = SEGMENTS.map((item) => {
    const list = windowEvents.filter((event) => event.segment === item.id);
    return {
      id: item.id,
      label: item.label,
      visitors: new Set(list.map((event) => event.vid)).size,
      views: list.length,
      avgEngagementSec: averageSeconds(list),
    };
  }).filter((item) => item.views > 0);

  const entityGroups = new Map<string, VisitEvent[]>();
  for (const event of scoped) {
    const key = `${event.segment}\n${event.entity}`;
    const list = entityGroups.get(key) ?? [];
    list.push(event);
    entityGroups.set(key, list);
  }
  const entities = Array.from(entityGroups.entries())
    .map(([key, list]) => {
      const [segmentId, entity] = key.split("\n") as [SegmentId, string];
      return {
        segment: segmentId,
        segmentLabel: segmentLabel(segmentId),
        entity,
        visitors: new Set(list.map((event) => event.vid)).size,
        views: list.length,
        avgEngagementSec: averageSeconds(list),
      };
    })
    .sort((a, b) => b.views - a.views || b.visitors - a.visitors)
    .slice(0, 20);

  const pageGroups = new Map<string, VisitEvent[]>();
  for (const event of scoped) {
    const list = pageGroups.get(event.path) ?? [];
    list.push(event);
    pageGroups.set(event.path, list);
  }
  const pages = Array.from(pageGroups.entries())
    .map(([path, list]) => ({
      path,
      visitors: new Set(list.map((event) => event.vid)).size,
      views: list.length,
      avgEngagementSec: averageSeconds(list),
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 20);

  return {
    days,
    includeInternal: options.includeInternal,
    segment,
    from: dayKey(start),
    to: dayKey(now),
    totals: {
      visitors: visitors.size,
      sessions: sessions.size,
      pageViews: scoped.length,
      avgEngagementSec: averageSeconds(scoped),
      engagedRate: sessions.size === 0 ? 0 : Math.round((engaged / sessions.size) * 100),
    },
    daily,
    countries,
    cities,
    segments,
    entities,
    pages,
    referrers: topCounts(
      scoped.map((event) => event.ref).filter(Boolean),
      12
    ).map((item) => ({ host: item.key, views: item.count })),
    devices: (["mobile", "tablet", "desktop"] as const)
      .map((device) => ({
        device,
        visitors: new Set(scoped.filter((event) => event.device === device).map((event) => event.vid)).size,
      }))
      .filter((item) => item.visitors > 0),
    hosts: (() => {
      const groups = new Map<string, VisitEvent[]>();
      for (const event of scoped) {
        if (!event.host) continue;
        const list = groups.get(event.host) ?? [];
        list.push(event);
        groups.set(event.host, list);
      }
      return Array.from(groups.entries())
        .map(([host, list]) => ({
          host,
          views: list.length,
          visitors: new Set(list.map((event) => event.vid)).size,
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 8);
    })(),
  };
}
