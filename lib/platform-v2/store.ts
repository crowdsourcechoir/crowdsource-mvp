/**
 * Platform V2 community spine — persistence (Supabase + local JSON).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getGardenByIdOrSlug } from "@/lib/song-garden-v2/garden/store";
import type { Garden } from "@/lib/song-garden-v2/garden/types";
import {
  DEFAULT_CONTRIBUTION_RIGHTS,
  canParticipate,
  normalizeCommunitySettings,
  normalizeContributionRights,
  type CommunitySettings,
  type ContributionNode,
  type ContributionReact,
  type ContributionRights,
  type CreditPack,
  type CreditPackEntry,
  type ParticipantIdentity,
  type ParticipationIndex,
  type RecognitionEvent,
  type RecognitionKind,
} from "./types";

const USE_LOCAL = () => process.env.USE_LOCAL_EVENTS === "true";

type LocalCommunityDb = {
  identities: ParticipantIdentity[];
  nodes: ContributionNode[];
  reacts: ContributionReact[];
  recognition: RecognitionEvent[];
  /** gardenId → settings (mirrors gardens.community). */
  settings: Record<string, CommunitySettings>;
};

const EMPTY_DB: LocalCommunityDb = {
  identities: [],
  nodes: [],
  reacts: [],
  recognition: [],
  settings: {},
};

let cache: LocalCommunityDb | null = null;

function dataPath(): string {
  return path.join(process.cwd(), ".data", "local-platform-v2.json");
}

function loadDb(): LocalCommunityDb {
  if (cache) return cache;
  const filePath = dataPath();
  if (!existsSync(filePath)) {
    cache = { ...EMPTY_DB, settings: {} };
    return cache;
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as Partial<LocalCommunityDb>;
    cache = {
      identities: Array.isArray(parsed.identities) ? parsed.identities : [],
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      reacts: Array.isArray(parsed.reacts) ? parsed.reacts : [],
      recognition: Array.isArray(parsed.recognition) ? parsed.recognition : [],
      settings: parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {},
    };
  } catch {
    cache = { ...EMPTY_DB, settings: {} };
  }
  return cache;
}

function persistDb(): void {
  if (!cache) return;
  const dir = path.dirname(dataPath());
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(dataPath(), JSON.stringify(cache, null, 2), "utf-8");
}

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function rowToIdentity(row: Record<string, unknown>): ParticipantIdentity {
  return {
    id: String(row.id),
    gardenId: String(row.garden_id),
    deviceId: String(row.device_id),
    displayName: row.display_name != null ? String(row.display_name) : null,
    email: row.email != null ? String(row.email) : null,
    claimed: Boolean(row.claimed),
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso()),
  };
}

function rowToNode(row: Record<string, unknown>): ContributionNode {
  const sourceType = row.source_type;
  const st =
    sourceType === "clip" || sourceType === "turn" || sourceType === "pulse"
      ? sourceType
      : "turn";
  return {
    id: String(row.id),
    gardenId: String(row.garden_id),
    chapterId: row.chapter_id != null ? String(row.chapter_id) : null,
    bloomEventId: row.bloom_event_id != null ? String(row.bloom_event_id) : null,
    deviceId: row.device_id != null ? String(row.device_id) : null,
    sourceType: st,
    sourceId: String(row.source_id),
    kind: String(row.kind ?? "other"),
    rights: normalizeContributionRights(row.rights as Partial<ContributionRights>),
    selected: Boolean(row.selected),
    performed: Boolean(row.performed),
    creditName: row.credit_name != null ? String(row.credit_name) : null,
    excerpt: row.excerpt != null ? String(row.excerpt) : null,
    reactCount: Number(row.react_count) || 0,
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso()),
  };
}

function rowToReact(row: Record<string, unknown>): ContributionReact {
  return {
    id: String(row.id),
    gardenId: String(row.garden_id),
    sourceType:
      row.source_type === "clip" || row.source_type === "turn" || row.source_type === "pulse"
        ? row.source_type
        : "turn",
    sourceId: String(row.source_id),
    deviceId: String(row.device_id),
    reaction: "heart",
    createdAt: String(row.created_at ?? nowIso()),
  };
}

function rowToRecognition(row: Record<string, unknown>): RecognitionEvent {
  const kind = row.kind;
  const rk: RecognitionKind =
    kind === "selected" || kind === "performed" || kind === "amplified" ? kind : "amplified";
  return {
    id: String(row.id),
    gardenId: String(row.garden_id),
    kind: rk,
    sourceType:
      row.source_type === "clip" || row.source_type === "turn" || row.source_type === "pulse"
        ? row.source_type
        : "turn",
    sourceId: String(row.source_id),
    actorDeviceId: row.actor_device_id != null ? String(row.actor_device_id) : null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at ?? nowIso()),
  };
}

/** Read community settings from garden row / local mirror. */
export async function getCommunitySettings(gardenId: string): Promise<CommunitySettings> {
  if (USE_LOCAL()) {
    const db = loadDb();
    return normalizeCommunitySettings(db.settings[gardenId]);
  }
  const garden = await getGardenByIdOrSlug(gardenId);
  if (!garden) return normalizeCommunitySettings(null);
  // community may live on raw row; updateGarden path stores via patchCommunitySettings
  if (!supabaseAdmin) return normalizeCommunitySettings(null);
  const { data } = await supabaseAdmin
    .from("gardens")
    .select("community")
    .eq("id", garden.id)
    .maybeSingle();
  return normalizeCommunitySettings((data?.community as Partial<CommunitySettings>) ?? null);
}

export async function patchCommunitySettings(
  gardenId: string,
  patch: Partial<CommunitySettings>
): Promise<CommunitySettings> {
  const current = await getCommunitySettings(gardenId);
  const next = normalizeCommunitySettings({ ...current, ...patch });
  if (USE_LOCAL()) {
    const db = loadDb();
    db.settings[gardenId] = next;
    persistDb();
    return next;
  }
  if (!supabaseAdmin) throw new Error("Database not configured.");
  const { error } = await supabaseAdmin
    .from("gardens")
    .update({ community: next, updated_at: nowIso() })
    .eq("id", gardenId);
  if (error) throw new Error(error.message);
  return next;
}

export async function getIdentity(
  gardenId: string,
  deviceId: string
): Promise<ParticipantIdentity | null> {
  const device = deviceId.trim();
  if (!device) return null;
  if (USE_LOCAL()) {
    return loadDb().identities.find((i) => i.gardenId === gardenId && i.deviceId === device) ?? null;
  }
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("garden_participant_identities")
    .select("*")
    .eq("garden_id", gardenId)
    .eq("device_id", device)
    .maybeSingle();
  if (error || !data) return null;
  return rowToIdentity(data as Record<string, unknown>);
}

export async function claimIdentity(args: {
  gardenId: string;
  deviceId: string;
  displayName: string;
  email: string;
}): Promise<ParticipantIdentity> {
  const deviceId = args.deviceId.trim();
  const displayName = args.displayName.trim();
  const email = args.email.trim().toLowerCase();
  if (!deviceId) throw new Error("deviceId required");
  if (!displayName) throw new Error("displayName required");
  if (!email || !email.includes("@")) throw new Error("Valid email required");

  if (USE_LOCAL()) {
    const db = loadDb();
    const existing = db.identities.find(
      (i) => i.gardenId === args.gardenId && i.deviceId === deviceId
    );
    const ts = nowIso();
    if (existing) {
      existing.displayName = displayName;
      existing.email = email;
      existing.claimed = true;
      existing.updatedAt = ts;
      persistDb();
      return existing;
    }
    const created: ParticipantIdentity = {
      id: newId(),
      gardenId: args.gardenId,
      deviceId,
      displayName,
      email,
      claimed: true,
      createdAt: ts,
      updatedAt: ts,
    };
    db.identities.push(created);
    persistDb();
    return created;
  }

  if (!supabaseAdmin) throw new Error("Database not configured.");
  const ts = nowIso();
  const { data, error } = await supabaseAdmin
    .from("garden_participant_identities")
    .upsert(
      {
        garden_id: args.gardenId,
        device_id: deviceId,
        display_name: displayName,
        email,
        claimed: true,
        updated_at: ts,
      },
      { onConflict: "garden_id,device_id" }
    )
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Claim failed");
  return rowToIdentity(data as Record<string, unknown>);
}

export async function assertCanParticipate(
  gardenId: string,
  deviceId: string | null | undefined
): Promise<{ ok: true; settings: CommunitySettings; identity: ParticipantIdentity | null } | { ok: false; reason: string; settings: CommunitySettings }> {
  const settings = await getCommunitySettings(gardenId);
  const identity = deviceId?.trim()
    ? await getIdentity(gardenId, deviceId.trim())
    : null;
  const gate = canParticipate(settings, identity);
  if (!gate.ok) {
    return { ok: false, reason: gate.reason || "Not allowed", settings };
  }
  return { ok: true, settings, identity };
}

export async function upsertContributionNode(args: {
  gardenId: string;
  chapterId?: string | null;
  bloomEventId?: string | null;
  deviceId?: string | null;
  sourceType: ContributionNode["sourceType"];
  sourceId: string;
  kind: string;
  rights?: Partial<ContributionRights>;
  creditName?: string | null;
  excerpt?: string | null;
}): Promise<ContributionNode> {
  const rights = normalizeContributionRights(args.rights ?? DEFAULT_CONTRIBUTION_RIGHTS);
  const ts = nowIso();

  if (USE_LOCAL()) {
    const db = loadDb();
    const existing = db.nodes.find(
      (n) =>
        n.gardenId === args.gardenId &&
        n.sourceType === args.sourceType &&
        n.sourceId === args.sourceId
    );
    if (existing) {
      existing.rights = rights;
      if (args.creditName !== undefined) existing.creditName = args.creditName;
      if (args.excerpt !== undefined) existing.excerpt = args.excerpt;
      if (args.kind) existing.kind = args.kind;
      existing.updatedAt = ts;
      persistDb();
      return existing;
    }
    const node: ContributionNode = {
      id: newId(),
      gardenId: args.gardenId,
      chapterId: args.chapterId ?? null,
      bloomEventId: args.bloomEventId ?? null,
      deviceId: args.deviceId ?? null,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      kind: args.kind || "other",
      rights,
      selected: false,
      performed: false,
      creditName: args.creditName ?? null,
      excerpt: args.excerpt ?? null,
      reactCount: 0,
      createdAt: ts,
      updatedAt: ts,
    };
    db.nodes.push(node);
    persistDb();
    return node;
  }

  if (!supabaseAdmin) throw new Error("Database not configured.");
  const { data, error } = await supabaseAdmin
    .from("garden_contribution_nodes")
    .upsert(
      {
        garden_id: args.gardenId,
        chapter_id: args.chapterId ?? null,
        bloom_event_id: args.bloomEventId ?? null,
        device_id: args.deviceId ?? null,
        source_type: args.sourceType,
        source_id: args.sourceId,
        kind: args.kind || "other",
        rights,
        credit_name: args.creditName ?? null,
        excerpt: args.excerpt ?? null,
        updated_at: ts,
      },
      { onConflict: "garden_id,source_type,source_id" }
    )
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Upsert contribution node failed");
  return rowToNode(data as Record<string, unknown>);
}

async function emitRecognition(args: {
  gardenId: string;
  kind: RecognitionKind;
  sourceType: ContributionNode["sourceType"];
  sourceId: string;
  actorDeviceId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<RecognitionEvent> {
  const ts = nowIso();
  if (USE_LOCAL()) {
    const ev: RecognitionEvent = {
      id: newId(),
      gardenId: args.gardenId,
      kind: args.kind,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      actorDeviceId: args.actorDeviceId ?? null,
      payload: args.payload ?? {},
      createdAt: ts,
    };
    loadDb().recognition.push(ev);
    persistDb();
    return ev;
  }
  if (!supabaseAdmin) throw new Error("Database not configured.");
  const { data, error } = await supabaseAdmin
    .from("garden_recognition_events")
    .insert({
      garden_id: args.gardenId,
      kind: args.kind,
      source_type: args.sourceType,
      source_id: args.sourceId,
      actor_device_id: args.actorDeviceId ?? null,
      payload: args.payload ?? {},
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Recognition emit failed");
  return rowToRecognition(data as Record<string, unknown>);
}

export async function markContributionSelected(args: {
  gardenId: string;
  sourceType: ContributionNode["sourceType"];
  sourceId: string;
  actorDeviceId?: string | null;
  selected?: boolean;
}): Promise<ContributionNode> {
  const selected = args.selected !== false;
  if (USE_LOCAL()) {
    const db = loadDb();
    let node = db.nodes.find(
      (n) =>
        n.gardenId === args.gardenId &&
        n.sourceType === args.sourceType &&
        n.sourceId === args.sourceId
    );
    if (!node) {
      node = await upsertContributionNode({
        gardenId: args.gardenId,
        sourceType: args.sourceType,
        sourceId: args.sourceId,
        kind: "other",
      });
    }
    node.selected = selected;
    node.updatedAt = nowIso();
    persistDb();
    if (selected) {
      await emitRecognition({
        gardenId: args.gardenId,
        kind: "selected",
        sourceType: args.sourceType,
        sourceId: args.sourceId,
        actorDeviceId: args.actorDeviceId,
      });
    }
    return node;
  }
  if (!supabaseAdmin) throw new Error("Database not configured.");
  await upsertContributionNode({
    gardenId: args.gardenId,
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    kind: "other",
  });
  const { data, error } = await supabaseAdmin
    .from("garden_contribution_nodes")
    .update({ selected, updated_at: nowIso() })
    .eq("garden_id", args.gardenId)
    .eq("source_type", args.sourceType)
    .eq("source_id", args.sourceId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Select failed");
  if (selected) {
    await emitRecognition({
      gardenId: args.gardenId,
      kind: "selected",
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      actorDeviceId: args.actorDeviceId,
    });
  }
  return rowToNode(data as Record<string, unknown>);
}

export async function markContributionPerformed(args: {
  gardenId: string;
  sourceType: ContributionNode["sourceType"];
  sourceId: string;
  actorDeviceId?: string | null;
}): Promise<ContributionNode> {
  if (USE_LOCAL()) {
    const db = loadDb();
    let node = db.nodes.find(
      (n) =>
        n.gardenId === args.gardenId &&
        n.sourceType === args.sourceType &&
        n.sourceId === args.sourceId
    );
    if (!node) {
      node = await upsertContributionNode({
        gardenId: args.gardenId,
        sourceType: args.sourceType,
        sourceId: args.sourceId,
        kind: "other",
      });
    }
    node.performed = true;
    node.updatedAt = nowIso();
    persistDb();
    await emitRecognition({
      gardenId: args.gardenId,
      kind: "performed",
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      actorDeviceId: args.actorDeviceId,
    });
    return node;
  }
  if (!supabaseAdmin) throw new Error("Database not configured.");
  await upsertContributionNode({
    gardenId: args.gardenId,
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    kind: "other",
  });
  const { data, error } = await supabaseAdmin
    .from("garden_contribution_nodes")
    .update({ performed: true, updated_at: nowIso() })
    .eq("garden_id", args.gardenId)
    .eq("source_type", args.sourceType)
    .eq("source_id", args.sourceId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Perform mark failed");
  await emitRecognition({
    gardenId: args.gardenId,
    kind: "performed",
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    actorDeviceId: args.actorDeviceId,
  });
  return rowToNode(data as Record<string, unknown>);
}

export async function listDiscoverableContributions(
  gardenId: string,
  opts?: { selectedOnly?: boolean }
): Promise<ContributionNode[]> {
  if (USE_LOCAL()) {
    return loadDb()
      .nodes.filter(
        (n) =>
          n.gardenId === gardenId &&
          n.rights.publicDisplay &&
          (opts?.selectedOnly ? n.selected : true)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  if (!supabaseAdmin) return [];
  let q = supabaseAdmin
    .from("garden_contribution_nodes")
    .select("*")
    .eq("garden_id", gardenId)
    .order("created_at", { ascending: false });
  if (opts?.selectedOnly) q = q.eq("selected", true);
  const { data, error } = await q;
  if (error) {
    console.warn("[platform-v2] list contributions failed:", error.message);
    return [];
  }
  return (data ?? [])
    .map((r) => rowToNode(r as Record<string, unknown>))
    .filter((n) => n.rights.publicDisplay);
}

export async function addReact(args: {
  gardenId: string;
  sourceType: ContributionNode["sourceType"];
  sourceId: string;
  deviceId: string;
}): Promise<{ react: ContributionReact; created: boolean; node: ContributionNode | null }> {
  const gate = await assertCanParticipate(args.gardenId, args.deviceId);
  if (!gate.ok) throw new Error(gate.reason);

  if (USE_LOCAL()) {
    const db = loadDb();
    const existing = db.reacts.find(
      (r) =>
        r.gardenId === args.gardenId &&
        r.sourceType === args.sourceType &&
        r.sourceId === args.sourceId &&
        r.deviceId === args.deviceId
    );
    let node =
      db.nodes.find(
        (n) =>
          n.gardenId === args.gardenId &&
          n.sourceType === args.sourceType &&
          n.sourceId === args.sourceId
      ) ?? null;
    if (existing) return { react: existing, created: false, node };
    const react: ContributionReact = {
      id: newId(),
      gardenId: args.gardenId,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      deviceId: args.deviceId,
      reaction: "heart",
      createdAt: nowIso(),
    };
    db.reacts.push(react);
    if (node) {
      node.reactCount += 1;
      node.updatedAt = nowIso();
    } else {
      node = await upsertContributionNode({
        gardenId: args.gardenId,
        sourceType: args.sourceType,
        sourceId: args.sourceId,
        kind: "other",
      });
      node.reactCount = 1;
    }
    persistDb();
    await emitRecognition({
      gardenId: args.gardenId,
      kind: "amplified",
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      actorDeviceId: args.deviceId,
      payload: { reaction: "heart" },
    });
    return { react, created: true, node };
  }

  if (!supabaseAdmin) throw new Error("Database not configured.");
  await upsertContributionNode({
    gardenId: args.gardenId,
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    kind: "other",
  });
  const { data: existing } = await supabaseAdmin
    .from("garden_contribution_reacts")
    .select("*")
    .eq("garden_id", args.gardenId)
    .eq("source_type", args.sourceType)
    .eq("source_id", args.sourceId)
    .eq("device_id", args.deviceId)
    .maybeSingle();
  if (existing) {
    const { data: nodeRow } = await supabaseAdmin
      .from("garden_contribution_nodes")
      .select("*")
      .eq("garden_id", args.gardenId)
      .eq("source_type", args.sourceType)
      .eq("source_id", args.sourceId)
      .maybeSingle();
    return {
      react: rowToReact(existing as Record<string, unknown>),
      created: false,
      node: nodeRow ? rowToNode(nodeRow as Record<string, unknown>) : null,
    };
  }
  const { data: inserted, error } = await supabaseAdmin
    .from("garden_contribution_reacts")
    .insert({
      garden_id: args.gardenId,
      source_type: args.sourceType,
      source_id: args.sourceId,
      device_id: args.deviceId,
      reaction: "heart",
    })
    .select("*")
    .single();
  if (error || !inserted) throw new Error(error?.message ?? "React failed");

  const { count } = await supabaseAdmin
    .from("garden_contribution_reacts")
    .select("*", { count: "exact", head: true })
    .eq("garden_id", args.gardenId)
    .eq("source_type", args.sourceType)
    .eq("source_id", args.sourceId);

  await supabaseAdmin
    .from("garden_contribution_nodes")
    .update({ react_count: count ?? 1, updated_at: nowIso() })
    .eq("garden_id", args.gardenId)
    .eq("source_type", args.sourceType)
    .eq("source_id", args.sourceId);

  await emitRecognition({
    gardenId: args.gardenId,
    kind: "amplified",
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    actorDeviceId: args.deviceId,
    payload: { reaction: "heart" },
  });

  const { data: nodeRow } = await supabaseAdmin
    .from("garden_contribution_nodes")
    .select("*")
    .eq("garden_id", args.gardenId)
    .eq("source_type", args.sourceType)
    .eq("source_id", args.sourceId)
    .maybeSingle();

  return {
    react: rowToReact(inserted as Record<string, unknown>),
    created: true,
    node: nodeRow ? rowToNode(nodeRow as Record<string, unknown>) : null,
  };
}

export async function listInGardenCredits(gardenId: string): Promise<
  Array<{ creditName: string; kind: string; selected: boolean; performed: boolean; reactCount: number }>
> {
  const nodes = await listDiscoverableContributions(gardenId);
  return nodes
    .filter((n) => n.creditName?.trim())
    .map((n) => ({
      creditName: n.creditName!.trim(),
      kind: n.kind,
      selected: n.selected,
      performed: n.performed,
      reactCount: n.reactCount,
    }));
}

export async function buildCreditPack(garden: Garden): Promise<CreditPack> {
  const settings = await getCommunitySettings(garden.id);
  const nodes = await listDiscoverableContributions(garden.id, { selectedOnly: false });
  const eligible = nodes.filter(
    (n) => n.rights.socialPosting || n.rights.showUse || n.selected || n.performed
  );

  let recognition: RecognitionEvent[] = [];
  if (USE_LOCAL()) {
    recognition = loadDb().recognition.filter((r) => r.gardenId === garden.id);
  } else if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("garden_recognition_events")
      .select("*")
      .eq("garden_id", garden.id);
    recognition = (data ?? []).map((r) => rowToRecognition(r as Record<string, unknown>));
  }

  const entries: CreditPackEntry[] = eligible.map((n) => {
    const kinds = new Set(
      recognition
        .filter((r) => r.sourceType === n.sourceType && r.sourceId === n.sourceId)
        .map((r) => r.kind)
    );
    return {
      sourceType: n.sourceType,
      sourceId: n.sourceId,
      creditName: n.creditName?.trim() || "Anonymous",
      kind: n.kind,
      selected: n.selected,
      performed: n.performed,
      reactCount: n.reactCount,
      rights: n.rights,
      recognition: Array.from(kinds),
      excerpt: n.excerpt,
    };
  });

  return {
    gardenId: garden.id,
    gardenSlug: garden.slug,
    gardenTitle: garden.title,
    generatedAt: nowIso(),
    campaignLabel: settings.campaignLabel,
    entries,
  };
}

function inWindow(iso: string, start: string | null, end: string | null): boolean {
  if (start && iso < start) return false;
  if (end && iso > end) return false;
  return true;
}

export async function computeParticipationIndex(garden: Garden): Promise<ParticipationIndex> {
  const settings = await getCommunitySettings(garden.id);
  const start = settings.campaignWindowStart;
  const end = settings.campaignWindowEnd;
  const notes: string[] = [];

  let nodes: ContributionNode[] = [];
  let reacts: ContributionReact[] = [];

  if (USE_LOCAL()) {
    const db = loadDb();
    nodes = db.nodes.filter((n) => n.gardenId === garden.id);
    reacts = db.reacts.filter((r) => r.gardenId === garden.id);
  } else if (supabaseAdmin) {
    const [nRes, rRes] = await Promise.all([
      supabaseAdmin.from("garden_contribution_nodes").select("*").eq("garden_id", garden.id),
      supabaseAdmin.from("garden_contribution_reacts").select("*").eq("garden_id", garden.id),
    ]);
    nodes = (nRes.data ?? []).map((r) => rowToNode(r as Record<string, unknown>));
    reacts = (rRes.data ?? []).map((r) => rowToReact(r as Record<string, unknown>));
  }

  const nodesInWindow = nodes.filter((n) => inWindow(n.createdAt, start, end));
  const reactsInWindow = reacts.filter((r) => inWindow(r.createdAt, start, end));

  const contributorDevices = new Set(
    nodesInWindow.map((n) => n.deviceId).filter((d): d is string => Boolean(d?.trim()))
  );
  const contributors = contributorDevices.size;

  const reachableAudience = settings.reachableAudience;
  let participationRate: number | null = null;
  if (reachableAudience && reachableAudience > 0) {
    participationRate = contributors / reachableAudience;
  } else {
    notes.push("reachableAudience not set — participation rate unavailable until Populus audience is configured.");
  }

  const sponsoredParticipationVolume = nodesInWindow.length + reactsInWindow.length;

  const performed = nodes.filter((n) => n.performed);
  const activationDevices = new Set(
    performed.map((n) => n.deviceId).filter((d): d is string => Boolean(d?.trim()))
  );
  // Credit path back: count distinct credited names on performed nodes as additional reach signals.
  const creditNames = new Set(
    performed.map((n) => n.creditName?.trim()).filter((n): n is string => Boolean(n))
  );
  const activationReach = Math.max(activationDevices.size, creditNames.size);
  if (performed.length === 0) {
    notes.push("activationReach is 0 until Live marks contributions performed (Composer/Live seam).");
  }

  return {
    gardenId: garden.id,
    gardenSlug: garden.slug,
    campaignLabel: settings.campaignLabel,
    window: { start, end },
    participationRate,
    contributors,
    reachableAudience,
    sponsoredParticipationVolume,
    contributionsInWindow: nodesInWindow.length,
    reactsInWindow: reactsInWindow.length,
    activationReach,
    notes,
  };
}

/** Hook from recordGardenContribution — graph node + optional credit. */
export async function recordCommunityContribution(args: {
  gardenId: string;
  chapterId?: string | null;
  bloomEventId?: string | null;
  deviceId?: string | null;
  sourceType: ContributionNode["sourceType"];
  sourceId: string;
  kind: string;
  creditName?: string | null;
  excerpt?: string | null;
  rights?: Partial<ContributionRights>;
}): Promise<ContributionNode | null> {
  try {
    if (args.deviceId) {
      const gate = await assertCanParticipate(args.gardenId, args.deviceId);
      if (!gate.ok) {
        console.warn("[platform-v2] contribution blocked by identity mode:", gate.reason);
        return null;
      }
      // Prefer claimed display name for credit when present.
      const credit =
        args.creditName?.trim() ||
        gate.identity?.displayName?.trim() ||
        null;
      return upsertContributionNode({ ...args, creditName: credit });
    }
    return upsertContributionNode(args);
  } catch (err) {
    console.warn("[platform-v2] recordCommunityContribution failed:", err);
    return null;
  }
}
