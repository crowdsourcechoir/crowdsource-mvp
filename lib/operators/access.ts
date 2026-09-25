import type { Actor, NavAccess, OperatorGrant } from "./types";

export function isOwner(actor: Actor | null): boolean {
  return actor?.role === "owner";
}

export function canSales(actor: Actor | null): boolean {
  return Boolean(actor && (actor.role === "owner" || actor.sales));
}

export function canStewardBloom(actor: Actor | null, bloomId: string): boolean {
  if (!actor || !bloomId) return false;
  if (actor.role === "owner") return true;
  return actor.stewardBlooms.includes(bloomId);
}

export function canComposeBloom(actor: Actor | null, bloomId: string): boolean {
  if (!actor || !bloomId) return false;
  if (actor.role === "owner") return true;
  return actor.composeBlooms.includes(bloomId) || actor.stewardBlooms.includes(bloomId);
}

export function canStewardGarden(actor: Actor | null, gardenId: string): boolean {
  if (!actor || !gardenId) return false;
  if (actor.role === "owner") return true;
  return actor.stewardGardens.includes(gardenId);
}

export function canComposeGarden(actor: Actor | null, gardenId: string): boolean {
  if (!actor || !gardenId) return false;
  if (actor.role === "owner") return true;
  return actor.composeGardens.includes(gardenId) || actor.stewardGardens.includes(gardenId);
}

export function hasComposerRoom(actor: Actor | null): boolean {
  if (!actor) return false;
  if (actor.role === "owner") return true;
  return (
    actor.composeBlooms.length > 0 ||
    actor.stewardBlooms.length > 0 ||
    actor.stewardGardens.length > 0
  );
}

export function navAccess(actor: Actor | null): NavAccess {
  const owner = actor?.role === "owner";
  return {
    gardens: Boolean(owner || (actor && actor.stewardGardens.length > 0)),
    blooms: Boolean(owner || (actor && actor.stewardBlooms.length > 0)),
    composer: hasComposerRoom(actor),
    sales: canSales(actor),
    marketing: Boolean(owner),
    live: Boolean(owner),
    settings: Boolean(owner),
  };
}

export function homePath(actor: Actor | null): string {
  if (!actor) return "/";
  if (actor.role === "owner") return "/admin/gardens";
  const nav = navAccess(actor);
  const rooms = [nav.gardens, nav.blooms, nav.composer, nav.sales].filter(Boolean).length;
  if (rooms === 1 && nav.sales) return "/admin/sales";
  if (rooms === 1 && nav.gardens && actor.stewardGardens.length === 1) {
    return `/admin/gardens/${actor.stewardGardens[0]}`;
  }
  if (rooms === 1 && nav.blooms && actor.stewardBlooms.length === 1) {
    return `/admin/events/${actor.stewardBlooms[0]}`;
  }
  if (rooms === 1 && nav.composer && actor.composeBlooms.length === 1 && actor.stewardBlooms.length === 0) {
    return `/admin/composer?bloom=${encodeURIComponent(actor.composeBlooms[0])}`;
  }
  if (nav.composer && actor.composeBlooms.length === 1 && !nav.gardens && !nav.sales && actor.stewardBlooms.length === 0) {
    return `/admin/composer?bloom=${encodeURIComponent(actor.composeBlooms[0])}`;
  }
  if (nav.sales && !nav.gardens && !nav.blooms && !nav.composer) return "/admin/sales";
  return "/admin/home";
}

export function grantsLookValid(grants: OperatorGrant[]): string | null {
  for (const grant of grants) {
    if (grant.capability === "sales") {
      if (grant.scopeType !== "sales") return "Sales access has no Bloom or Garden.";
      continue;
    }
    if (grant.capability === "compose" && grant.scopeType !== "bloom") {
      return "Composer access is attached to a Bloom.";
    }
    if (grant.capability === "steward" && grant.scopeType !== "bloom" && grant.scopeType !== "garden") {
      return "Steward access is attached to a Bloom or a Song Garden.";
    }
    if (!grant.scopeId?.trim()) return "Pick a Bloom or Song Garden for each grant.";
  }
  return null;
}

const OWNER_PREFIXES = [
  "/admin/settings",
  "/admin/marketing",
  "/admin/live",
  "/admin/roots",
  "/admin/resonance",
  "/admin/events/new",
  "/admin/gardens/new",
  "/api/operators",
  "/api/live-prompt-game",
  "/api/resonance",
  "/api/memory",
  "/api/summarize",
  "/api/transcribe",
  "/api/admin/runway-status",
];

function isOwnerPath(pathname: string): boolean {
  return OWNER_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isPublicPath(pathname: string, method: string, searchParams: URLSearchParams): boolean {
  if (pathname === "/" || pathname.startsWith("/e/") || pathname.startsWith("/g/")) return true;
  if (pathname === "/forgot" || pathname === "/reset-password" || pathname === "/invite") return true;
  if (pathname === "/reset-root-password") return true;
  if (
    pathname.startsWith("/api/turnstile") ||
    pathname.startsWith("/api/sales/cron") ||
    pathname === "/api/sales/gmail/callback" ||
    pathname.startsWith("/api/marketing/webhooks") ||
    pathname.startsWith("/api/marketing/unsubscribe") ||
    pathname.startsWith("/api/marketing/ingest") ||
    pathname.startsWith("/api/p/")
  ) {
    return true;
  }
  if (pathname === "/api/auth/login" || pathname === "/api/auth/forgot" || pathname === "/api/auth/reset") {
    return true;
  }
  if (pathname === "/api/auth/invite" || pathname === "/api/auth/logout") return true;
  if (pathname === "/api/auth/session" && method === "GET") return true;

  if (method === "POST" && pathname === "/api/agent/participants") return true;
  if (method === "POST" && /^\/api\/agent\/conversations\/[^/]+\/send$/.test(pathname)) return true;
  if (method === "POST" && /^\/api\/agent\/conversations\/[^/]+\/media\/prepare$/.test(pathname)) return true;
  if (method === "GET" && /^\/api\/agent\/conversations\/[^/]+$/.test(pathname)) return true;
  if (method === "POST" && (pathname === "/api/songgarden" || pathname.startsWith("/api/songgarden/upload/"))) {
    return true;
  }
  if (method === "GET" && pathname === "/api/events" && searchParams.get("slug")) return true;
  if (method === "GET" && /^\/api\/events\/[^/]+\/(garden-snapshot|activity)$/.test(pathname)) return true;
  if (method === "GET" && /^\/api\/gardens\/[^/]+\/snapshot$/.test(pathname)) return true;
  if (method === "POST" && /^\/api\/gardens\/[^/]+\/pulse$/.test(pathname)) return true;
  return false;
}

function bloomIdFrom(pathname: string, searchParams: URLSearchParams): string | null {
  const fromQuery = searchParams.get("eventId") || searchParams.get("bloom");
  if (fromQuery) return fromQuery;
  const event = pathname.match(/^\/admin\/events\/([^/]+)/);
  if (event && event[1] !== "new") return decodeURIComponent(event[1]);
  const song = pathname.match(/^\/admin\/songgarden\/([^/]+)/);
  if (song) return decodeURIComponent(song[1]);
  const conductor = pathname.match(/^\/admin\/conductor\/([^/]+)/);
  if (conductor) return decodeURIComponent(conductor[1]);
  const apiEvent = pathname.match(/^\/api\/events\/([^/]+)/);
  if (apiEvent) return decodeURIComponent(apiEvent[1]);
  return null;
}

function gardenIdFrom(pathname: string): string | null {
  const page = pathname.match(/^\/admin\/gardens\/([^/]+)/);
  if (page && page[1] !== "new") return decodeURIComponent(page[1]);
  const api = pathname.match(/^\/api\/gardens\/([^/]+)/);
  if (api && api[1] !== "by-event" && api[1] !== "demos") return decodeURIComponent(api[1]);
  return null;
}

export type AccessResult =
  | { kind: "public" }
  | { kind: "allow" }
  | { kind: "deny"; status: 401 | 403 }
  | { kind: "redirect"; to: string };

/**
 * Page and API gate. Public participant routes stay open.
 * Owner sees everything. Everyone else is limited to their grants.
 */
export function decideAccess(
  pathname: string,
  method: string,
  searchParams: URLSearchParams,
  actor: Actor | null
): AccessResult {
  if (isPublicPath(pathname, method, searchParams)) return { kind: "public" };
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api")) return { kind: "public" };
  if (!actor) return pathname.startsWith("/api") ? { kind: "deny", status: 401 } : { kind: "redirect", to: "/" };

  const owner = actor.role === "owner";
  const home = homePath(actor);

  if (pathname === "/admin" || pathname === "/admin/") {
    return owner ? { kind: "allow" } : { kind: "redirect", to: home };
  }
  if (pathname === "/admin/home") return { kind: "allow" };

  if (method === "POST" && pathname === "/api/events") {
    return owner ? { kind: "allow" } : { kind: "deny", status: 403 };
  }
  if (method === "POST" && pathname === "/api/gardens") {
    return owner ? { kind: "allow" } : { kind: "deny", status: 403 };
  }
  if (
    method === "POST" &&
    (pathname === "/api/sales/gmail/sends" ||
      /^\/api\/sales\/queue\/[^/]+\/mark-sent$/.test(pathname) ||
      pathname === "/api/sales/gmail/disconnect" ||
      pathname === "/api/sales/gmail/connect")
  ) {
    return owner ? { kind: "allow" } : { kind: "deny", status: 403 };
  }

  if (isOwnerPath(pathname) || pathname.startsWith("/api/marketing")) {
    if (owner) return { kind: "allow" };
    return pathname.startsWith("/api") ? { kind: "deny", status: 403 } : { kind: "redirect", to: home };
  }

  if (pathname.startsWith("/admin/sales") || pathname.startsWith("/api/sales")) {
    if (canSales(actor)) return { kind: "allow" };
    return pathname.startsWith("/api") ? { kind: "deny", status: 403 } : { kind: "redirect", to: home };
  }

  if (pathname === "/api/agent/media" || pathname.startsWith("/api/agent/interview-submissions")) {
    const bloomId = searchParams.get("eventId");
    if (pathname.startsWith("/api/agent/interview-submissions")) {
      if (!bloomId) return { kind: "deny", status: 403 };
      return canComposeBloom(actor, bloomId) ? { kind: "allow" } : { kind: "deny", status: 403 };
    }
    if (owner || hasComposerRoom(actor)) return { kind: "allow" };
    return { kind: "deny", status: 403 };
  }

  if (pathname.startsWith("/api/songgarden")) {
    const bloomId = searchParams.get("eventId");
    if (!bloomId) return { kind: "deny", status: 403 };
    if (method === "DELETE" || (method === "PATCH" && /^\/api\/songgarden\/[^/]+$/.test(pathname))) {
      return canStewardBloom(actor, bloomId) ? { kind: "allow" } : { kind: "deny", status: 403 };
    }
    return canComposeBloom(actor, bloomId) ? { kind: "allow" } : { kind: "deny", status: 403 };
  }

  if (pathname === "/api/admin/composer/library" || pathname.startsWith("/admin/composer") || pathname.startsWith("/admin/canvas") || pathname.startsWith("/admin/composition") || pathname.startsWith("/admin/songgarden/")) {
    if (!hasComposerRoom(actor)) {
      return pathname.startsWith("/api") ? { kind: "deny", status: 403 } : { kind: "redirect", to: home };
    }
    const bloomId = bloomIdFrom(pathname, searchParams);
    if (bloomId && !canComposeBloom(actor, bloomId)) {
      return pathname.startsWith("/api") ? { kind: "deny", status: 403 } : { kind: "redirect", to: home };
    }
    return { kind: "allow" };
  }

  if (pathname.startsWith("/api/events/storyboard") || pathname.startsWith("/api/events/hero-upload")) {
    if (owner || actor.stewardBlooms.length > 0) return { kind: "allow" };
    return { kind: "deny", status: 403 };
  }

  if (pathname.startsWith("/admin/events") || pathname.startsWith("/api/events") || pathname.startsWith("/admin/conductor/")) {
    if (pathname === "/admin/events") {
      if (owner || actor.stewardBlooms.length > 0) return { kind: "allow" };
      return { kind: "redirect", to: home };
    }
    const bloomId = bloomIdFrom(pathname, searchParams);
    const stewardSurface =
      pathname.startsWith("/admin/events/") ||
      pathname.startsWith("/admin/conductor/") ||
      (pathname.startsWith("/api/events") && method !== "GET" && method !== "HEAD");
    if (bloomId) {
      const allowed = stewardSurface ? canStewardBloom(actor, bloomId) : canComposeBloom(actor, bloomId);
      if (!allowed) {
        return pathname.startsWith("/api") ? { kind: "deny", status: 403 } : { kind: "redirect", to: home };
      }
      return { kind: "allow" };
    }
    if (owner || hasComposerRoom(actor)) return { kind: "allow" };
    return pathname.startsWith("/api") ? { kind: "deny", status: 403 } : { kind: "redirect", to: home };
  }

  if (pathname.startsWith("/admin/gardens") || pathname.startsWith("/api/gardens")) {
    const gardenId = gardenIdFrom(pathname);
    const composition = gardenId ? pathname.includes("/composition") : false;
    if (pathname === "/admin/gardens" || pathname === "/api/gardens" || pathname === "/api/gardens/by-event") {
      if (owner || actor.stewardGardens.length > 0 || (pathname.startsWith("/api") && hasComposerRoom(actor))) {
        return { kind: "allow" };
      }
      return pathname.startsWith("/api") ? { kind: "deny", status: 403 } : { kind: "redirect", to: home };
    }
    if (!gardenId) {
      return owner ? { kind: "allow" } : pathname.startsWith("/api") ? { kind: "deny", status: 403 } : { kind: "redirect", to: home };
    }
    if (composition) {
      return canComposeGarden(actor, gardenId) ? { kind: "allow" } : { kind: "deny", status: 403 };
    }
    if (canStewardGarden(actor, gardenId)) return { kind: "allow" };
    if (method === "GET" && canComposeGarden(actor, gardenId)) return { kind: "allow" };
    return pathname.startsWith("/api") ? { kind: "deny", status: 403 } : { kind: "redirect", to: home };
  }

  if (owner) return { kind: "allow" };
  return pathname.startsWith("/api") ? { kind: "deny", status: 403 } : { kind: "redirect", to: home };
}
