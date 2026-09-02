import { requireSupabaseAdmin } from "./client";
import { normalizeOrgName } from "../dedupe";
import {
  SEARCH_MIN_CHARS,
  mergeSearchHits,
  matchRank,
  orIlike,
  sanitizeSearchTerm,
  type SalesSearchHit,
  type SearchMatch,
} from "../search/query";

const TABLE_LIMIT = 40;

function snippet(value: string | null | undefined, fallback: string): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
}

export async function searchSalesDatabase(rawQuery: string): Promise<SalesSearchHit[]> {
  const term = sanitizeSearchTerm(rawQuery);
  if (term.length < SEARCH_MIN_CHARS) return [];

  const db = requireSupabaseAdmin();
  const normalized = normalizeOrgName(term) || term.toLowerCase();

  const [orgsRes, contactsRes, oppsRes, draftsRes, findingsRes] = await Promise.all([
    db
      .from("organizations")
      .select("id, name, website_url, domain, location_city, location_region")
      .or(orIlike(["name", "normalized_name", "domain", "website_url", "location_city", "location_region"], term))
      .limit(TABLE_LIMIT),
    db
      .from("contacts")
      .select("id, organization_id, full_name, role_title, role_category, email")
      .or(orIlike(["full_name", "role_title", "role_category", "email", "phone"], term))
      .limit(TABLE_LIMIT),
    db
      .from("opportunities")
      .select("id, organization_id, title, event_or_initiative_name, description, target_contact_role_hint")
      .or(orIlike(["title", "event_or_initiative_name", "description", "target_contact_role_hint"], term))
      .limit(TABLE_LIMIT),
    db
      .from("outreach_drafts")
      .select("id, opportunity_id, ai_subject, edited_subject, ai_body, edited_body")
      .or(orIlike(["ai_subject", "edited_subject", "ai_body", "edited_body"], term))
      .limit(TABLE_LIMIT),
    db
      .from("research_findings")
      .select("organization_id, claim_type, claim_text")
      .or(orIlike(["claim_text", "claim_type"], term))
      .limit(TABLE_LIMIT),
  ]);

  for (const res of [orgsRes, contactsRes, oppsRes, draftsRes, findingsRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const orgRows = (orgsRes.data ?? []) as {
    id: string;
    name: string;
    website_url: string | null;
    domain: string | null;
    location_city: string | null;
    location_region: string | null;
  }[];
  const contactRows = (contactsRes.data ?? []) as {
    organization_id: string;
    full_name: string | null;
    role_title: string | null;
    role_category: string | null;
    email: string | null;
  }[];
  const oppRows = (oppsRes.data ?? []) as {
    id: string;
    organization_id: string;
    title: string;
    event_or_initiative_name: string | null;
    description: string | null;
    target_contact_role_hint: string | null;
  }[];
  const draftRows = (draftsRes.data ?? []) as {
    opportunity_id: string;
    ai_subject: string;
    edited_subject: string | null;
    ai_body: string;
    edited_body: string | null;
  }[];
  const findingRows = (findingsRes.data ?? []) as {
    organization_id: string;
    claim_type: string;
    claim_text: string;
  }[];

  const matches: SearchMatch[] = [];

  for (const row of orgRows) {
    const hay = [row.name, row.domain, row.website_url, row.location_city, row.location_region]
      .filter(Boolean)
      .join(" ");
    const loc = [row.location_city, row.location_region].filter(Boolean).join(", ");
    const label = row.name.toLowerCase().includes(term.toLowerCase())
      ? "Organization"
      : loc.toLowerCase().includes(term.toLowerCase())
        ? `Location · ${loc}`
        : row.domain?.toLowerCase().includes(term.toLowerCase())
          ? `Domain · ${row.domain}`
          : "Organization";
    matches.push({
      organizationId: row.id,
      organizationName: row.name,
      kind: "organization",
      label,
      rank: Math.max(matchRank("organization", row.name, term), matchRank("organization", hay, term)),
    });
  }

  if (normalized && normalized !== term.toLowerCase()) {
    const extra = await db
      .from("organizations")
      .select("id, name, website_url")
      .ilike("normalized_name", `%${normalized}%`)
      .limit(TABLE_LIMIT);
    if (extra.error) throw new Error(extra.error.message);
    for (const row of extra.data ?? []) {
      matches.push({
        organizationId: row.id as string,
        organizationName: row.name as string,
        kind: "organization",
        label: "Organization",
        rank: matchRank("organization", row.name as string, term),
      });
      if (!orgRows.some((o) => o.id === row.id)) {
        orgRows.push({
          id: row.id as string,
          name: row.name as string,
          website_url: (row.website_url as string | null) ?? null,
          domain: null,
          location_city: null,
          location_region: null,
        });
      }
    }
  }

  for (const row of contactRows) {
    const name = row.full_name?.trim() || "Contact";
    const bits = [name, row.role_title, row.email].filter(Boolean).join(" · ");
    matches.push({
      organizationId: row.organization_id,
      kind: "contact",
      label: snippet(bits, "Contact"),
      rank: Math.max(
        matchRank("contact", row.full_name ?? "", term),
        matchRank("contact", row.role_title ?? "", term),
        matchRank("contact", row.email ?? "", term),
        matchRank("contact", row.role_category ?? "", term)
      ),
    });
  }

  for (const row of oppRows) {
    const title = row.event_or_initiative_name || row.title;
    matches.push({
      organizationId: row.organization_id,
      kind: "opportunity",
      label: snippet(title, "Opportunity"),
      rank: Math.max(
        matchRank("opportunity", row.title, term),
        matchRank("opportunity", row.event_or_initiative_name ?? "", term),
        matchRank("opportunity", row.description ?? "", term)
      ),
    });
  }

  const draftOppIds = Array.from(new Set(draftRows.map((d) => d.opportunity_id).filter(Boolean)));
  let draftsByOppOrg = new Map<string, string>();
  if (draftOppIds.length > 0) {
    const { data, error } = await db.from("opportunities").select("id, organization_id, title").in("id", draftOppIds);
    if (error) throw new Error(error.message);
    draftsByOppOrg = new Map((data ?? []).map((row) => [row.id as string, row.organization_id as string]));
    for (const row of data ?? []) {
      if (!oppRows.some((o) => o.id === row.id)) {
        oppRows.push({
          id: row.id as string,
          organization_id: row.organization_id as string,
          title: row.title as string,
          event_or_initiative_name: null,
          description: null,
          target_contact_role_hint: null,
        });
      }
    }
  }

  for (const row of draftRows) {
    const orgId = draftsByOppOrg.get(row.opportunity_id);
    if (!orgId) continue;
    const subject = row.edited_subject || row.ai_subject;
    matches.push({
      organizationId: orgId,
      kind: "draft",
      label: snippet(subject, "Email"),
      rank: Math.max(
        matchRank("draft", subject, term),
        matchRank("draft", row.edited_body ?? "", term),
        matchRank("draft", row.ai_body ?? "", term)
      ),
    });
  }

  for (const row of findingRows) {
    matches.push({
      organizationId: row.organization_id,
      kind: "finding",
      label: snippet(row.claim_text, row.claim_type || "Research"),
      rank: matchRank("finding", row.claim_text, term),
    });
  }

  const missingOrgIds = Array.from(
    new Set(matches.map((m) => m.organizationId).filter((id) => !orgRows.some((o) => o.id === id)))
  );
  if (missingOrgIds.length > 0) {
    const { data, error } = await db.from("organizations").select("id, name, website_url").in("id", missingOrgIds);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      orgRows.push({
        id: row.id as string,
        name: row.name as string,
        website_url: (row.website_url as string | null) ?? null,
        domain: null,
        location_city: null,
        location_region: null,
      });
    }
  }

  const orgIds = Array.from(new Set(matches.map((m) => m.organizationId)));
  const queueByOrg = new Map<string, { queueItemId: string; opportunityTitle: string | null }>();
  if (orgIds.length > 0) {
    const { data: queuedOpps, error: oppErr } = await db
      .from("opportunities")
      .select("id, organization_id, title")
      .in("organization_id", orgIds);
    if (oppErr) throw new Error(oppErr.message);
    const oppIds = (queuedOpps ?? []).map((row) => row.id as string);
    if (oppIds.length > 0) {
      const { data: queueRows, error: queueErr } = await db
        .from("approval_queue_items")
        .select("id, opportunity_id")
        .eq("status", "pending")
        .in("opportunity_id", oppIds);
      if (queueErr) throw new Error(queueErr.message);
      const oppById = new Map((queuedOpps ?? []).map((row) => [row.id as string, row]));
      for (const row of queueRows ?? []) {
        const opp = oppById.get(row.opportunity_id as string);
        if (!opp) continue;
        const orgId = opp.organization_id as string;
        if (!queueByOrg.has(orgId)) {
          queueByOrg.set(orgId, {
            queueItemId: row.id as string,
            opportunityTitle: (opp.title as string | null) ?? null,
          });
        }
      }
    }
  }

  return mergeSearchHits(
    matches,
    orgRows.map((o) => ({ id: o.id, name: o.name, websiteUrl: o.website_url })),
    queueByOrg
  );
}
