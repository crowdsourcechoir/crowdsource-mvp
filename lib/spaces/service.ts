import { randomBytes } from "crypto";
import type { PitchSlide } from "@/app/sobeca-song-garden/content";
import { pitchDescription } from "@/lib/pitches/model";
import { listPitchAdmin, createPitch, loadPitch, updatePitch } from "@/lib/pitches/service";
import { hashPitchPassword } from "@/lib/sobeca-pitch/access";
import { getOrganization, listOrganizationsByIds } from "@/lib/sales/db/organizations";
import { listOpportunitiesByIds } from "@/lib/sales/db/opportunities";
import { readWorkspaceSettings, writeWorkspaceSettings } from "@/lib/settings/store";
import { readActorFromCookies, signedInOwner } from "@/lib/operators/current";
import {
  addDeal,
  canonicalHref,
  claimAccount,
  placedPitchHref,
  placementIsShareable,
  removePlacement,
  renameAccount,
  resolveSpace,
  savePlacement,
  setAccountPassword,
  updateDeal,
  type ClientSpacesState,
  type PlacementDraft,
  type SpaceResolution,
  type SpaceRole,
} from "@/lib/spaces/model";
import { buildAccountViews, type SpaceAccountView, type SpacePitchBrief } from "@/lib/spaces/view";

export type { SpaceAccountView, SpaceDealView, SpaceRowView } from "@/lib/spaces/view";

function newId(prefix: "deal" | "place"): string {
  return `${prefix}_${randomBytes(4).toString("hex")}`;
}

export async function spaceEditorAllowed(): Promise<boolean> {
  if (await signedInOwner()) return true;
  const actor = await readActorFromCookies();
  return Boolean(actor && (actor.role === "owner" || actor.sales));
}

async function readState(): Promise<{ state: ClientSpacesState; error: string | null }> {
  const stored = await readWorkspaceSettings({ skipCache: true });
  return { state: stored.settings.clientSpaces, error: stored.error };
}

async function writeState(state: ClientSpacesState): Promise<string | null> {
  const written = await writeWorkspaceSettings({ clientSpaces: state });
  return written.error;
}

async function pitchMap(): Promise<Map<string, SpacePitchBrief>> {
  const listed = await listPitchAdmin();
  return new Map(
    listed.pitches.map((pitch) => [
      pitch.id,
      { id: pitch.id, name: pitch.name, live: pitch.live, organizationId: pitch.organizationId },
    ])
  );
}

export async function listSpaces(): Promise<{
  accounts: SpaceAccountView[];
  pitches: SpacePitchBrief[];
  error: string | null;
}> {
  const { state, error } = await readState();
  const pitches = await pitchMap();
  const orgIds = state.accounts.map((account) => account.organizationId);
  const oppIds = state.deals.map((deal) => deal.salesOpportunityId).filter((id): id is string => Boolean(id));
  const names = new Map<string, string>();
  const opportunities = new Map<string, string>();
  try {
    const orgs = await listOrganizationsByIds(orgIds);
    for (const org of orgs) names.set(org.id, org.name);
  } catch {
    /* names fall back to the slug */
  }
  try {
    const rows = await listOpportunitiesByIds(oppIds);
    for (const row of rows) opportunities.set(row.id, row.title);
  } catch {
    /* titles fall back to the deal name */
  }
  return {
    accounts: buildAccountViews(state, names, opportunities, pitches),
    pitches: Array.from(pitches.values()),
    error,
  };
}

export async function placedPitchHrefFor(pitchId: string): Promise<string | null> {
  const { state } = await readState();
  return placedPitchHref(state, pitchId);
}

export async function openWorkspace(input: {
  organizationId: string;
  slug: string;
  password: string;
  dealName: string;
  dealSlug: string;
  salesOpportunityId?: string | null;
}): Promise<{ error?: string; status: number }> {
  const { state, error } = await readState();
  if (error) return { error, status: 503 };
  const password = input.password.trim();
  const claimed = claimAccount(state, {
    organizationId: input.organizationId,
    slug: input.slug,
    passwordHash: password ? hashPitchPassword(password) : null,
  });
  if ("error" in claimed) return { error: claimed.error, status: 400 };
  const deal = addDeal(claimed.state, {
    id: newId("deal"),
    organizationId: claimed.account.organizationId,
    name: input.dealName,
    slug: input.dealSlug,
    salesOpportunityId: input.salesOpportunityId ?? null,
    current: true,
  });
  if ("error" in deal) return { error: deal.error, status: 400 };
  const written = await writeState(deal.state);
  if (written) return { error: written, status: 503 };
  return { status: 200 };
}

export async function saveAccount(
  organizationId: string,
  patch: { slug?: string; password?: string; clearPassword?: boolean }
): Promise<{ error?: string; status: number }> {
  const { state, error } = await readState();
  if (error) return { error, status: 503 };
  let next = state;
  if (patch.slug !== undefined) {
    const renamed = renameAccount(next, organizationId, patch.slug);
    if ("error" in renamed) return { error: renamed.error, status: 400 };
    next = renamed.state;
  }
  if (patch.clearPassword) {
    const cleared = setAccountPassword(next, organizationId, null);
    if ("error" in cleared) return { error: cleared.error, status: 400 };
    next = cleared.state;
  } else if (patch.password !== undefined && patch.password.trim()) {
    const locked = setAccountPassword(next, organizationId, hashPitchPassword(patch.password.trim()));
    if ("error" in locked) return { error: locked.error, status: 400 };
    next = locked.state;
  }
  const written = await writeState(next);
  if (written) return { error: written, status: 503 };
  return { status: 200 };
}

export async function openDeal(input: {
  organizationId: string;
  name: string;
  slug: string;
  salesOpportunityId?: string | null;
  current?: boolean;
}): Promise<{ error?: string; status: number }> {
  const { state, error } = await readState();
  if (error) return { error, status: 503 };
  const deal = addDeal(state, {
    id: newId("deal"),
    organizationId: input.organizationId,
    name: input.name,
    slug: input.slug,
    salesOpportunityId: input.salesOpportunityId ?? null,
    current: input.current,
  });
  if ("error" in deal) return { error: deal.error, status: 400 };
  const written = await writeState(deal.state);
  if (written) return { error: written, status: 503 };
  return { status: 200 };
}

export async function saveDeal(
  dealId: string,
  patch: { name?: string; slug?: string; current?: boolean }
): Promise<{ error?: string; status: number }> {
  const { state, error } = await readState();
  if (error) return { error, status: 503 };
  const updated = updateDeal(state, dealId, patch);
  if ("error" in updated) return { error: updated.error, status: 400 };
  const written = await writeState(updated.state);
  if (written) return { error: written, status: 503 };
  return { status: 200 };
}

async function attachPitch(pitchId: string, organizationId: string): Promise<string | null> {
  const pitch = await loadPitch(pitchId);
  if (!pitch) return "That deck was not found.";
  if (pitch.organizationId && pitch.organizationId !== organizationId) {
    return "That deck belongs to another organization.";
  }
  if (!pitch.organizationId) {
    const updated = await updatePitch(pitchId, { organizationId });
    if (updated.error) return updated.error;
  }
  return null;
}

export async function saveRow(
  dealId: string,
  draft: PlacementDraft & { createPitch?: boolean }
): Promise<{ error?: string; status: number }> {
  const { state, error } = await readState();
  if (error) return { error, status: 503 };
  const deal = state.deals.find((item) => item.id === dealId);
  if (!deal) return { error: "That deal was not found.", status: 404 };

  const { createPitch: shouldCreate, ...placement } = draft;
  let pitchId = placement.pitchId;
  if (shouldCreate) {
    const created = await createPitch({
      name: `${deal.name} ${placement.role}`.slice(0, 80),
      prompt: `A ${placement.role} for ${deal.name}.`,
      live: false,
      organizationId: deal.organizationId,
    });
    if (!created.pitch) return { error: created.error ?? "Could not create the deck.", status: created.status };
    pitchId = created.pitch.id;
  }

  const fresh = await readState();
  if (fresh.error) return { error: fresh.error, status: 503 };
  if (pitchId) {
    const attached = await attachPitch(pitchId, deal.organizationId);
    if (attached) return { error: attached, status: 400 };
  }
  const saved = savePlacement(fresh.state, {
    ...placement,
    dealId,
    pitchId,
    id: placement.id ?? newId("place"),
  });
  if ("error" in saved) return { error: saved.error, status: 400 };
  const written = await writeState(saved.state);
  if (written) return { error: written, status: 503 };
  return { status: 200 };
}

export async function deleteRow(dealId: string, role: SpaceRole): Promise<{ error?: string; status: number }> {
  const { state, error } = await readState();
  if (error) return { error, status: 503 };
  const removed = removePlacement(state, dealId, role);
  if ("error" in removed) return { error: removed.error, status: 400 };
  const written = await writeState(removed.state);
  if (written) return { error: written, status: 503 };
  return { status: 200 };
}

export type SpacePage =
  | { kind: "none" }
  | { kind: "redirect"; href: string }
  | {
      kind: "index";
      title: string;
      slug: string;
      organizationId: string;
      passwordHash: string | null;
      items: { title: string; href: string; shareable: boolean }[];
    }
  | {
      kind: "document";
      title: string;
      description: string;
      slug: string;
      organizationId: string;
      passwordHash: string | null;
      shareable: boolean;
      role: SpaceRole;
      body: string;
      linkUrl: string | null;
      linkLabel: string | null;
      slides: PitchSlide[] | null;
    };

export async function readSpacePage(segments: string[]): Promise<SpacePage> {
  const { state } = await readState();
  const resolved: SpaceResolution = resolveSpace(state, segments);
  if (resolved.kind === "none") return { kind: "none" };
  if (resolved.kind === "redirect") return resolved;

  let organizationName = resolved.account.slug;
  try {
    const org = await getOrganization(resolved.account.organizationId);
    if (org?.name) organizationName = org.name;
  } catch {
    /* the slug still titles the page */
  }

  const pitches = await pitchMap();
  const account = {
    slug: resolved.account.slug,
    organizationId: resolved.account.organizationId,
    passwordHash: resolved.account.passwordHash,
  };

  if (resolved.kind === "index") {
    const items = state.placements
      .filter((placement) => placement.dealId === resolved.deal.id)
      .map((placement) => {
        const pitch = placement.pitchId ? pitches.get(placement.pitchId) ?? null : null;
        return {
          title: placement.title,
          href: canonicalHref(resolved.account, resolved.deal, placement),
          shareable: placementIsShareable(placement, pitch ? pitch.live : null),
        };
      })
      .filter((item) => item.shareable);
    return { kind: "index", title: organizationName, ...account, items };
  }

  const pitch = resolved.placement.pitchId ? await loadPitch(resolved.placement.pitchId) : null;
  const pitchLive = pitch ? pitch.live : resolved.placement.pitchId ? false : null;
  const slides = pitch && pitch.slides.length > 0 ? pitch.slides : null;
  return {
    kind: "document",
    title: pitch?.title || resolved.placement.title || organizationName,
    description: pitch ? pitchDescription(pitch.slides, pitch.prompt) : resolved.placement.body.slice(0, 180),
    ...account,
    shareable: placementIsShareable(resolved.placement, pitchLive),
    role: resolved.placement.role,
    body: resolved.placement.body,
    linkUrl: resolved.placement.linkUrl,
    linkLabel: resolved.placement.linkLabel,
    slides,
  };
}
